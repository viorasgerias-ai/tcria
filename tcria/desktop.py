"""Aplicativo desktop local: nenhum documento é transmitido pela rede."""
import json
import queue
import re
import threading
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext, ttk

from .custody import record_review, restore_bundle, verify_review
from .pipeline import run_pipeline, verify_bundle

APP_VERSION = "0.3.0"


def anchor_value(value):
    value = value.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", value):
        raise ValueError("Informe a referência SHA-256 guardada: 64 caracteres hexadecimais.")
    return value


def save_reference(path, bundle_dir, anchor):
    anchor = anchor_value(anchor)
    path, bundle = Path(path).resolve(), Path(bundle_dir).resolve()
    if path == bundle or bundle in path.parents:
        raise ValueError("Guarde a referência fora da pasta do resultado.")
    # Never silently replace a reference for another case.
    with path.open("x", encoding="utf-8") as stream:
        stream.write(anchor + "\n")


class Desktop:
    def __init__(self, root):
        self.root = root
        root.title("oranizator-igualizator — Integridade documental")
        root.geometry("1000x810")
        root.minsize(780, 650)
        self.jobs = queue.Queue()
        self.busy = False
        self.controls = []
        self.source = tk.StringVar()
        self.output = tk.StringVar()
        self.responsible = tk.StringVar()
        self.origin = tk.StringVar()
        self.strict = tk.BooleanVar(value=False)
        self.bundle = tk.StringVar()
        self.anchor = tk.StringVar()
        self.destination = tk.StringVar()
        self.records = tk.StringVar()
        self.reviewer = tk.StringVar()
        self.decision = tk.StringVar(value="REQUEST_CHANGES")
        self.reason = tk.StringVar()
        self.review_file = tk.StringVar()
        self.status = tk.StringVar(value="Pronto. Os documentos são processados neste computador.")
        shell = ttk.Frame(root, padding=18)
        shell.pack(fill="both", expand=True)
        ttk.Label(shell, text="oranizator-igualizator", font=("Helvetica", 23, "bold")).pack(anchor="w")
        ttk.Label(shell, text="Organize cópias, confira alterações e preserve os caminhos de origem.").pack(anchor="w", pady=(2, 12))
        tabs = ttk.Notebook(shell)
        tabs.pack(fill="both", expand=True)
        organize = self.tab(tabs, "1. Organizar")
        self.path_field(organize, "Pasta com os documentos", self.source)
        self.path_field(organize, "Nova pasta de resultado", self.output, new=True)
        self.text_field(organize, "Responsável pelo lote", self.responsible)
        self.text_field(organize, "Origem declarada dos documentos", self.origin)
        self.controls.append(ttk.Checkbutton(organize, text="Modo estrito: bloquear quando houver qualquer pendência", variable=self.strict))
        self.controls[-1].pack(anchor="w", pady=8)
        ttk.Label(organize, text="Os originais ficam no lugar. A saída deve ser uma pasta nova fora da entrada.\nRegras não fornecidas aparecem como pendências, inclusive no modo estrito.", wraplength=840).pack(anchor="w", pady=8)
        self.button(organize, "Organizar e gerar relatório", self.organize)
        check = self.tab(tabs, "2. Conferir e devolver")
        self.bundle_fields(check)
        self.button(check, "Conferir integridade", self.verify)
        self.path_field(check, "Pasta de origem ou destino das cópias", self.destination)
        actions = ttk.Frame(check)
        actions.pack(fill="x", pady=6)
        self.button(actions, "Simular devolução", lambda: self.restore(True), side="left")
        self.button(actions, "Devolver arquivos", lambda: self.restore(False), side="left")
        ttk.Label(check, text="Arquivos iguais ficam intactos. Arquivos diferentes bloqueiam a devolução.\nNenhum arquivo é apagado; nomes e subpastas são preservados.", wraplength=840).pack(anchor="w", pady=8)
        review = self.tab(tabs, "3. Revisão humana")
        self.path_field(review, "Pasta do resultado", self.bundle)
        self.path_field(review, "Pasta para guardar decisões (fora do resultado)", self.records)
        self.text_field(review, "Responsável pela revisão", self.reviewer)
        row = ttk.Frame(review)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text="Decisão", width=25).pack(side="left")
        choice = ttk.Combobox(row, textvariable=self.decision, state="readonly", values=("APPROVE", "REJECT", "REQUEST_CHANGES"))
        choice.pack(side="left", fill="x", expand=True)
        self.controls.append(choice)
        self.text_field(review, "Justificativa", self.reason)
        self.button(review, "Registrar decisão vinculada ao resultado", self.review)
        self.path_field(review, "Arquivo da decisão para conferir", self.review_file, file=True)
        self.button(review, "Conferir decisão e vínculo", self.check_review)
        ttk.Label(review, text="Usa a referência da aba Conferir. Decisão declarada não é assinatura digital.\nAPPROVE = aprovar; REJECT = rejeitar; REQUEST_CHANGES = solicitar ajustes.", wraplength=840).pack(anchor="w", pady=8)
        ttk.Label(shell, textvariable=self.status, wraplength=920).pack(anchor="w", pady=(10, 4))
        self.log = scrolledtext.ScrolledText(shell, height=9, state="disabled", wrap="word")
        self.log.pack(fill="both", expand=True)
        ttk.Label(shell, text=f"Versão {APP_VERSION} · Funciona offline · SHA-256 detecta alterações; não impede edições.", wraplength=920).pack(anchor="w", pady=(6, 0))
        root.protocol("WM_DELETE_WINDOW", self.close)
        self.poll_id = root.after(100, self.poll)

    def tab(self, notebook, title):
        frame = ttk.Frame(notebook, padding=14)
        notebook.add(frame, text=title)
        return frame

    def button(self, parent, label, command, side=None):
        button = ttk.Button(parent, text=label, command=lambda: self.guard(command))
        button.pack(side=side or "top", anchor="w", padx=(0, 8), pady=4)
        self.controls.append(button)
        return button

    def guard(self, command):
        try:
            command()
        except Exception as exc:
            self.failure(exc)

    def text_field(self, parent, label, variable, readonly=False):
        row = ttk.Frame(parent)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text=label, width=25, wraplength=185).pack(side="left")
        entry = ttk.Entry(row, textvariable=variable)
        entry.pack(side="left", fill="x", expand=True)
        if readonly:
            # App Sandbox: paths come only from the system dialogs (user-selected access).
            entry.state(["readonly"])
        self.controls.append(entry)
        return row

    def path_field(self, parent, label, variable, new=False, file=False):
        row = self.text_field(parent, label, variable, readonly=True)
        def browse():
            selected = filedialog.askopenfilename(parent=self.root) if file else filedialog.askdirectory(parent=self.root)
            if selected:
                if new:
                    selected = str(Path(selected) / datetime.now().strftime("caso-%Y%m%d-%H%M%S"))
                variable.set(selected)
        self.button(row, "Escolher…", browse, side="left")

    def bundle_fields(self, parent):
        self.path_field(parent, "Pasta do resultado", self.bundle)
        self.text_field(parent, "Referência SHA-256 guardada", self.anchor)
        actions = ttk.Frame(parent)
        actions.pack(fill="x")
        self.button(actions, "Abrir referência independente…", self.load_anchor, side="left")
        self.button(actions, "Guardar referência…", self.store_anchor, side="left")

    def required(self, variable, label):
        value = variable.get().strip()
        if not value:
            raise ValueError("Preencha: " + label)
        return value

    def organize(self):
        source = self.required(self.source, "pasta dos documentos")
        output = self.required(self.output, "nova pasta de resultado")
        responsible = self.required(self.responsible, "responsável")
        origin = self.required(self.origin, "origem declarada")
        strict = self.strict.get()
        def completed(result):
            self.bundle.set(result["output_dir"])
            self.anchor.set(result["anchor"])
            self.destination.set(source)
            self.status.set("Resultado criado com pendências para revisão. Guarde a referência fora da pasta do resultado.")
            if result["readiness"] == "BLOCKED":
                self.status.set("Modo estrito bloqueado por pendências. O relatório foi preservado para revisão.")
        self.start(lambda: run_pipeline(source, output, responsible, origin, strict), completed)

    def verify(self):
        bundle = self.required(self.bundle, "pasta do resultado")
        anchor = anchor_value(self.anchor.get())
        def completed(result):
            self.status.set("Integridade conferida contra a referência guardada." if result["valid"] else "FALHA de integridade. Confira os erros abaixo.")
        self.start(lambda: verify_bundle(bundle, anchor), completed)

    def restore(self, dry_run):
        bundle = self.required(self.bundle, "pasta do resultado")
        anchor = anchor_value(self.anchor.get())
        destination = self.required(self.destination, "pasta de destino")
        self.start(lambda: restore_bundle(bundle, destination, anchor, dry_run))

    def review(self):
        args = (self.required(self.bundle, "pasta do resultado"),
                self.required(self.records, "pasta das decisões"), anchor_value(self.anchor.get()),
                self.required(self.reviewer, "revisor"), self.decision.get(),
                self.required(self.reason, "justificativa"))
        self.start(lambda: record_review(*args), lambda result: self.review_file.set(result["record"]))

    def check_review(self):
        args = (self.required(self.bundle, "pasta do resultado"),
                self.required(self.review_file, "arquivo da decisão"), anchor_value(self.anchor.get()))
        def completed(result):
            self.status.set("Decisão e vínculo conferidos." if result["valid"] else "FALHA na verificação da decisão. Confira os erros abaixo.")
        self.start(lambda: verify_review(*args), completed)

    def load_anchor(self):
        path = filedialog.askopenfilename(parent=self.root, title="Referência guardada separadamente")
        if path:
            bundle = Path(self.required(self.bundle, "pasta do resultado")).resolve()
            selected = Path(path).resolve()
            if bundle == selected or bundle in selected.parents:
                raise ValueError("Escolha a referência guardada fora do resultado; a cópia interna não é independente.")
            self.anchor.set(anchor_value(selected.read_text(encoding="utf-8")))

    def store_anchor(self):
        bundle = self.required(self.bundle, "pasta do resultado")
        anchor = anchor_value(self.anchor.get())
        path = filedialog.asksaveasfilename(parent=self.root, title="Guardar referência fora do resultado", defaultextension=".sha256", initialfile="referencia-caso.sha256")
        if path:
            save_reference(path, bundle, anchor)
            self.status.set("Referência guardada separadamente. Preserve-a em local protegido.")

    def start(self, operation, completed=None):
        if self.busy:
            return
        self.busy = True
        self.status.set("Processando… Aguarde a conclusão antes de fechar o aplicativo.")
        for widget in self.controls:
            widget.state(["disabled"])
        # Tk objects must only be touched (and released) on the main thread; the
        # worker gets plain values and a queue, never a reference to self/Tk.
        self.completed = completed
        jobs = self.jobs
        def worker(operation=operation):
            try:
                jobs.put((operation(), None))
            except Exception as exc:
                jobs.put((None, exc))
        self.worker = threading.Thread(target=worker, daemon=False)
        self.worker.start()

    def poll(self):
        try:
            result, error = self.jobs.get_nowait()
            completed, self.completed = self.completed, None
        except queue.Empty:
            pass
        else:
            self.busy = False
            for widget in self.controls:
                widget.state(["!disabled"])
            if error:
                self.failure(error)
            else:
                self.status.set("Operação concluída. Confira o resultado abaixo.")
                self.log.configure(state="normal")
                self.log.delete("1.0", "end")
                self.log.insert("end", json.dumps(result, ensure_ascii=False, indent=2))
                self.log.configure(state="disabled")
                if completed:
                    completed(result)
        self.poll_id = self.root.after(100, self.poll)

    def failure(self, error):
        self.status.set("A operação falhou; preserve o resultado parcial para diagnóstico, se houver.")
        messagebox.showerror("oranizator-igualizator — operação não concluída", str(error), parent=self.root)

    def close(self):
        if self.busy:
            messagebox.showinfo("Operação em andamento", "Aguarde a conclusão para preservar a gravação dos arquivos.", parent=self.root)
            return
        self.root.destroy()


def main():
    root = tk.Tk()
    Desktop(root)
    root.mainloop()


if __name__ == "__main__":
    main()

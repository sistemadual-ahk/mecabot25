import tkinter as tk
from tkinter import ttk, messagebox
import serial, serial.tools.list_ports
import time, threading, re, sys, traceback

# ======================= CONFIGURACIÓN GENERAL =======================
PWM_MIN = 500
PWM_MAX = 2500
NUM_CANALES = 32
BAUDRATE = 9600
READ_TIMEOUT = 1.0
ACK_TIMEOUT = 10.0
RESP_TIMEOUT = 12.0

# ======================= ESTADO GLOBAL =======================
puerto_serial = None
serial_lock = threading.Lock()
sliders_info = []
updating = False
lbl_fb = None
lbl_lr = None

# Ventana de posiciones
pos_win = None
pos_tree = None
toggle_pos_btn = None  # botón Mostrar/Ocultar

# ASCII / terminal
ascii_send_text = None
rx_text = None
rx_vsb = None

# >>> MONITOR EN VIVO: estado e hilos
_monitor_thread = None
_monitor_stop_evt = threading.Event()
_monitor_pause_evt = threading.Event()
_root_ref = None

# ======================= CONVERSIONES =======================
def angulo_a_pwm(angulo):
    return int(round(PWM_MIN + (angulo / 225) * (PWM_MAX - PWM_MIN)))

def pwm_a_angulo(pwm):
    return int(round((pwm - PWM_MIN) * 225 / (PWM_MAX - PWM_MIN)))

# ======================= SERIAL =======================
def puertos_disponibles():
    return [p.device for p in serial.tools.list_ports.comports()]

def _serial_ok():
    return (puerto_serial is not None) and puerto_serial.is_open

def conectar_serial():
    global puerto_serial
    port = combo_puertos.get()
    if not port:
        label_estado.config(text="Elegí un puerto", fg="red")
        return
    try:
        ps = serial.Serial(port, BAUDRATE, timeout=READ_TIMEOUT)
        with serial_lock:
            if puerto_serial and puerto_serial.is_open:
                try:
                    puerto_serial.close()
                except:
                    pass
            puerto_serial = ps
            puerto_serial.reset_input_buffer()
            puerto_serial.reset_output_buffer()
        label_estado.config(text=f"Conectado a {port}", fg="green")

        # >>> MONITOR EN VIVO: (re)iniciar hilo lector
        _monitor_restart()

    except Exception as e:
        label_estado.config(text=f"Error: {e}", fg="red")

def refrescar_puertos():
    combo_puertos["values"] = puertos_disponibles()

# ======================= UTILIDADES DE LECTURA =======================
def _read_until_predicate(timeout_s, predicate):
    t0 = time.time()
    buf = b''
    while time.time() - t0 <= timeout_s:
        with serial_lock:
            b = puerto_serial.read(1) if _serial_ok() else b''
        if b:
            buf += b
            try:
                if predicate(buf):
                    break
            except Exception:
                pass
        else:
            time.sleep(0.001)
    return buf

def _wait_by_stars_and_regex(min_stars, regex, hard_timeout):
    def _pred(b):
        if b.count(b'*') < min_stars:
            return False
        s = b.decode('ascii', errors='ignore')
        return bool(regex.search(s))
    buf = _read_until_predicate(hard_timeout, _pred)
    return buf.decode(errors='ignore')

def _send_and_read_until(min_stars, regex_pat, hard_timeout, cmd):
    if not _serial_ok():
        raise RuntimeError("Puerto no conectado")
    # >>> MONITOR EN VIVO: pausar monitor mientras esperamos una respuesta estructurada
    _monitor_pause(True)
    try:
        with serial_lock:
            puerto_serial.reset_input_buffer()
            puerto_serial.write(cmd)
        rx = re.compile(regex_pat)
        return _wait_by_stars_and_regex(min_stars, rx, hard_timeout)
    finally:
        _monitor_pause(False)

# ======================= ENVÍOS (PWM/Velocidad) =======================
def enviar_paquete(canal, pwm, velocidad):
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red")
        return
    pwm = int(round(float(pwm)))
    velocidad = int(velocidad)
    paquete = f"*{canal:02d}{pwm:04d}{velocidad:02d}*".encode('ascii')
    with serial_lock:
        puerto_serial.write(paquete)

def enviar_todos():
    if not _serial_ok():
        messagebox.showwarning("Serial", "Puerto no conectado.")
        return
    paquete = "*"
    alguno = False
    for canal, pwm_slider, vel_var, activo_var, *_ in sliders_info:
        if activo_var.get():
            pwm = int(round(pwm_slider.get()))
            vel = int(vel_var.get())
            paquete += f"{canal:02d}{pwm:04d}{vel:02d}"
            alguno = True
    paquete += "*"
    if not alguno:
        messagebox.showinfo("Enviar Todos", "No hay canales activos para enviar.")
        return
    with serial_lock:
        puerto_serial.reset_input_buffer()
        puerto_serial.write(paquete.encode('ascii'))
    label_estado.config(text="Paquete múltiple enviado", fg="blue")

def actualizar_desde_pwm(canal, pwm_slider, vel_var, activo_var, pwm_box, vel_box):
    global updating
    if updating:
        return
    updating = True
    try:
        pwm = int(float(pwm_slider.get()))
        pwm_box.config(state='normal'); pwm_box.delete(0, tk.END); pwm_box.insert(0, str(pwm)); pwm_box.config(state='readonly')
    finally:
        updating = False
    if activo_var.get():
        enviar_paquete(canal, pwm, vel_var.get())

def on_vel_changed(event, canal, vel_var, vel_box):
    vel_txt = vel_var.get()
    vel_box.config(state='normal'); vel_box.delete(0, tk.END); vel_box.insert(0, vel_txt); vel_box.config(state='readonly')

# ======================= COMANDOS MOTORES DC (BTS7960) =======================
def _fmt_pct(pct_text):
    try:
        v = int(pct_text.strip())
    except:
        v = 0
    v = max(0, min(100, v))
    return f"{v:03d}"

def motor_cmd(cual, signo, pct_text):
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red")
        return
    if cual not in ('A', 'B') or signo not in ('+', '-'):
        return
    ddd = _fmt_pct(pct_text)
    cmd = f"&{cual}{signo}{ddd}".encode('ascii')
    try:
        with serial_lock:
            puerto_serial.write(cmd)
        label_estado.config(text=f"Motor {cual} ← {signo}{ddd}%", fg="blue")
    except Exception as e:
        messagebox.showerror("Motores", f"Error enviando comando: {e}")

def motores_parada():
    """Enviar &S para detener ambos motores."""
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red")
        return
    try:
        with serial_lock:
            puerto_serial.write(b'&S')
        label_estado.config(text="Motores detenidos (&S)", fg="blue")
    except Exception as e:
        messagebox.showerror("Motores", f"Error enviando &S: {e}")

def motores_aplicar_ambos(signoA, signoB, pctA_text, pctB_text):
    """
    Envía &A±DDD y &B±DDD consecutivos dentro del mismo lock
    para que se apliquen 'al mismo tiempo'.
    """
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red")
        return
    if signoA not in ('+', '-') or signoB not in ('+', '-'):
        return
    dA = _fmt_pct(pctA_text)
    dB = _fmt_pct(pctB_text)
    try:
        with serial_lock:
            puerto_serial.write(f"&A{signoA}{dA}".encode('ascii'))
            puerto_serial.write(f"&B{signoB}{dB}".encode('ascii'))
        label_estado.config(text=f"Ambos motores aplicados → A {signoA}{dA}% | B {signoB}{dB}%", fg="blue")
    except Exception as e:
        messagebox.showerror("Motores", f"Error aplicando ambos: {e}")

# HOME ($)
def enviar_home():
    """Enviar '$' para ir a Home."""
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red")
        return
    try:
        with serial_lock:
            puerto_serial.write(b'$')
        label_estado.config(text="Comando HOME ($) enviado", fg="blue")
    except Exception as e:
        messagebox.showerror("HOME", f"Error enviando $: {e}")

# PARADA INMEDIATA DE SERVOS ('|')
def enviar_parada_servos_servos():
    """Enviar '|' para parada inmediata de servos (E-Stop)."""
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red")
        return
    try:
        with serial_lock:
            puerto_serial.write(b'|')
        label_estado.config(text="Parada inmediata de servos (|) enviada", fg="blue")
    except Exception as e:
        messagebox.showerror("Parada servos", f"Error enviando '|': {e}")

# HOME PARCIALES (']' derecho, '%' izquierdo, '\' cabeza)
def enviar_home_brazo_derecho():
    """Enviar ']' para HOME del brazo derecho (0,1,2,3,4,16)."""
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red"); return
    try:
        with serial_lock:
            puerto_serial.write(b']')
        label_estado.config(text="HOME brazo derecho (]) enviado", fg="blue")
    except Exception as e:
        messagebox.showerror("HOME derecho", f"Error enviando ']': {e}")

def enviar_home_brazo_izquierdo():
    """Enviar '%' para HOME del brazo izquierdo (5,6,7,8,9,17)."""
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red"); return
    try:
        with serial_lock:
            puerto_serial.write(b'%')
        label_estado.config(text="HOME brazo izquierdo (%) enviado", fg="blue")
    except Exception as e:
        messagebox.showerror("HOME izquierdo", f"Error enviando '%': {e}")

def enviar_home_cabeza():
    """Enviar '\' para HOME de cabeza (18,19,20)."""
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red"); return
    try:
        with serial_lock:
            puerto_serial.write(b'\\')  # backslash escapado
        label_estado.config(text="HOME cabeza (\\) enviado", fg="blue")
    except Exception as e:
        messagebox.showerror("HOME cabeza", f"Error enviando '\\': {e}")

# ======================= COMANDOS DE SENSORES =======================
def medir_FB_instantaneo():
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red"); return
    try:
        # Pausar monitor durante la captura estructurada
        _monitor_pause(True)
        with serial_lock:
            puerto_serial.reset_input_buffer()
            puerto_serial.write(b'_')
        t0 = time.time()
        buf = b''
        while time.time() - t0 <= RESP_TIMEOUT:
            with serial_lock:
                b = puerto_serial.read(1)
            if b:
                buf += b
                s = buf.decode('ascii', errors='ignore')
                if '_{' in s and '}_' in s:
                    break
            else:
                time.sleep(0.001)
        txt = buf.decode(errors='ignore')
        i = txt.find('_{'); j = txt.find('}_', i+2)
        if i != -1 and j != -1:
            lbl_fb.config(text=f"_{txt[i+2:j]}_", fg="black")
            label_estado.config(text="Medición F/B lista", fg="green")
        else:
            lbl_fb.config(text="(sin datos)", fg="red")
            label_estado.config(text="No se detectó formato _{Fxxxx,Byyyy}_", fg="red")
    except Exception as e:
        messagebox.showerror("Sensores", f"Error: {e}")
    finally:
        _monitor_pause(False)

def escaneo_tilt_minFB():
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red"); return
    try:
        label_estado.config(text="Ejecutando escaneo tilt...", fg="blue")
        txt = _send_and_read_until(4, r"\^\{F\d{4},B\d{4}\}\^", 120.0, b'^')
        i = txt.find('^{'); j = txt.find('}^', i+2)
        if i != -1 and j != -1:
            lbl_fb.config(text=f"^{txt[i+2:j]}^", fg="black")
            label_estado.config(text="Escaneo tilt listo", fg="green")
        else:
            lbl_fb.config(text="(sin datos)", fg="red")
            label_estado.config(text="No se detectó formato ^{Fxxxx,Byyyy}^", fg="red")
    except Exception as e:
        messagebox.showerror("Sensores", f"Error: {e}")

def giro_izq_medicion_LR():
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red"); return
    try:
        label_estado.config(text="Giro izquierda + medición...", fg="blue")
        txt = _send_and_read_until(2, r"\[\{L\d{4},R\d{4}\}\[", 120.0, b'[')
        i = txt.find('[{'); j = txt.find('}[', i+2)
        if i != -1 and j != -1:
            lbl_lr.config(text=f"[{txt[i+2:j]}]", fg="black")
            label_estado.config(text="Giro izquierda + medición listo", fg="green")
        else:
            lbl_lr.config(text="(sin datos)", fg="red")
            label_estado.config(text="No se detectó formato [{Lxxxx,Rxxxx}[", fg="red")
    except Exception as e:
        messagebox.showerror("Sensores", f"Error: {e}")

# ======================= VENTANA DE POSICIONES =======================
def _ensure_pos_window():
    """Crea la ventana de posiciones si no existe; si existe, la trae al frente."""
    global pos_win, pos_tree, toggle_pos_btn
    if pos_win and pos_win.winfo_exists():
        try:
            pos_win.deiconify()
            pos_win.lift()
        except:
            pass
        return

    pos_win = tk.Toplevel()
    pos_win.title("Posiciones de Servos")
    pos_win.geometry("380x560")
    pos_win.resizable(True, True)

    cols = ("Canal", "PWM (µs)", "Vel")
    tree = ttk.Treeview(pos_win, columns=cols, show="headings", height=28)
    for c in cols:
        tree.heading(c, text=c)
    tree.column("Canal", width=70, anchor=tk.CENTER)
    tree.column("PWM (µs)", width=120, anchor=tk.CENTER)
    tree.column("Vel", width=80, anchor=tk.CENTER)

    # Scroll
    vsb = ttk.Scrollbar(pos_win, orient="vertical", command=tree.yview)
    tree.configure(yscrollcommand=vsb.set)
    tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    vsb.pack(side=tk.RIGHT, fill=tk.Y)

    # Pre-cargar 32 filas con '-'
    for ch in range(NUM_CANALES):
        tree.insert("", tk.END, iid=f"ch{ch}", values=(f"{ch:02d}", "-", "-"))

    pos_tree = tree

    def _on_close():
        global pos_win, pos_tree, toggle_pos_btn
        pos_tree = None
        if pos_win:
            try:
                pos_win.destroy()
            except:
                pass
        pos_win = None
        if toggle_pos_btn and toggle_pos_btn.winfo_exists():
            toggle_pos_btn.config(text="Mostrar tabla de posiciones")

    pos_win.protocol("WM_DELETE_WINDOW", _on_close)

def _update_pos_window(vistos_dict):
    """Actualiza la tabla con los valores de 'vistos_dict' o, si falta algún canal,
    muestra el valor actual del slider (para que siempre veas 32)."""
    global pos_tree
    if not (pos_tree and pos_tree.winfo_exists()):
        return
    for ch in range(NUM_CANALES):
        if ch in vistos_dict:
            pwm, vel = vistos_dict[ch]
        else:
            _, pwm_slider, vel_var, *_ = sliders_info[ch]
            pwm = int(round(pwm_slider.get()))
            try:
                vel = int(vel_var.get())
            except:
                vel = 1
        pos_tree.set(f"ch{ch}", column="PWM (µs)", value=str(pwm))
        pos_tree.set(f"ch{ch}", column="Vel", value=f"{vel:02d}")

def toggle_tabla_posiciones():
    """Muestra/Oculta la ventana de posiciones. Al mostrar, lee y actualiza."""
    global pos_win, toggle_pos_btn
    if pos_win and pos_win.winfo_exists():
        try:
            pos_win.destroy()
        except:
            pass
        pos_win = None
        if toggle_pos_btn and toggle_pos_btn.winfo_exists():
            toggle_pos_btn.config(text="Mostrar tabla de posiciones")
    else:
        _ensure_pos_window()
        if toggle_pos_btn and toggle_pos_btn.winfo_exists():
            toggle_pos_btn.config(text="Ocultar tabla de posiciones")
        leer_posiciones()
        try:
            pos_win.lift()
        except:
            pass

# ======================= LECTURA DE POSICIONES ('.') =======================
def leer_posiciones():
    global updating
    if not _serial_ok():
        messagebox.showwarning("Serial", "Puerto no conectado.")
        _ensure_pos_window()
        _update_pos_window({})
        return
    try:
        _monitor_pause(True)
        with serial_lock:
            puerto_serial.reset_input_buffer()
            puerto_serial.write(b'.')
        t0 = time.time()
        buf = b''
        while time.time() - t0 <= RESP_TIMEOUT:
            with serial_lock:
                chunk = puerto_serial.read(64)
            if chunk:
                buf += chunk
                if len(re.findall(rb"\d{2}\d{4}\d{2}", buf)) >= NUM_CANALES:
                    time.sleep(0.050)
                    with serial_lock:
                        buf += puerto_serial.read(256)
                    break
            else:
                time.sleep(0.002)

        txt = buf.decode('ascii', errors='ignore')
        triples = re.findall(r"(\d{2})(\d{4})(\d{2})", txt)
        if not triples:
            label_estado.config(text="No se detectaron bloques CCPPPPVV", fg="red")
            _ensure_pos_window()
            _update_pos_window({})
            return

        vistos = {}
        for cc, pppp, vv in triples:
            canal = int(cc)
            if 0 <= canal < NUM_CANALES:
                pwm = max(PWM_MIN, min(PWM_MAX, int(pppp)))
                vel = max(1, min(10, int(vv)))
                vistos[canal] = (pwm, vel)

        updating = True
        try:
            for canal, pwm_slider, vel_var, activo_var, pwm_box, vel_box, vel_combo in sliders_info:
                if canal in vistos:
                    pwm, vel = vistos[canal]
                    pwm_slider.set(pwm)
                    pwm_box.config(state='normal'); pwm_box.delete(0, tk.END); pwm_box.insert(0, str(pwm)); pwm_box.config(state='readonly')
                    vel_var.set(f"{vel:02d}")
                    vel_box.config(state='normal'); vel_box.delete(0, tk.END); vel_box.insert(0, f"{vel:02d}"); vel_box.config(state='readonly')
                    vel_combo.set(f"{vel:02d}")
        finally:
            updating = False

        label_estado.config(text="Posiciones leídas y aplicadas", fg="green")
        _ensure_pos_window()
        _update_pos_window(vistos)

    except Exception as e:
        messagebox.showerror("Leer Posiciones", f"Error: {e}")
    finally:
        _monitor_pause(False)

# ======================= ASCII / TERMINAL =======================
def ascii_enviar():
    """Envía tal cual el contenido de la caja ASCII (como bytes ASCII)."""
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red"); return
    if not ascii_send_text:
        return
    try:
        data = ascii_send_text.get("1.0", tk.END)
        if not data:
            return
        b = data.encode('ascii', errors='replace')
        if len(b) == 0:
            return
        with serial_lock:
            puerto_serial.write(b)
        label_estado.config(text=f"Enviados {len(b)} bytes ASCII", fg="blue")
    except Exception as e:
        messagebox.showerror("ASCII", f"Error enviando: {e}")

def _rx_append(texto):
    if not rx_text:
        return
    rx_text.config(state='normal')
    rx_text.insert(tk.END, texto)
    rx_text.see(tk.END)
    rx_text.config(state='disabled')

def recibir_leer_disponibles():
    """(Sigue disponible) Lee bytes disponibles sin bloquear y los muestra."""
    if not _serial_ok():
        label_estado.config(text="Puerto no conectado", fg="red"); return
    try:
        with serial_lock:
            n = puerto_serial.in_waiting if hasattr(puerto_serial, 'in_waiting') else 0
            data = puerto_serial.read(n) if n and n > 0 else b''
        if data:
            try:
                s = data.decode('ascii', errors='replace')
            except Exception:
                s = repr(data)
            _rx_append(s)
            label_estado.config(text=f"Recibidos {len(data)} bytes", fg="green")
        else:
            label_estado.config(text="No hay datos disponibles", fg="black")
    except Exception as e:
        messagebox.showerror("RX", f"Error leyendo: {e}")

def recibir_limpiar():
    if not rx_text:
        return
    rx_text.config(state='normal')
    rx_text.delete("1.0", tk.END)
    rx_text.config(state='disabled')

# >>> MONITOR EN VIVO: control
def _monitor_pause(pause: bool):
    if pause:
        _monitor_pause_evt.set()
    else:
        _monitor_pause_evt.clear()

def _monitor_stop():
    _monitor_stop_evt.set()

def _monitor_restart():
    """Detiene el hilo actual (si hay) y lanza uno nuevo."""
    global _monitor_thread
    _monitor_stop()
    # pequeño respiro para que termine
    time.sleep(0.05)
    _monitor_stop_evt.clear()
    _monitor_pause_evt.clear()
    _monitor_thread = threading.Thread(target=_monitor_loop, daemon=True)
    _monitor_thread.start()

def _monitor_loop():
    """Hilo que lee en 'tiempo real' y vuelca en la ventana RX sin bloquear GUI."""
    while not _monitor_stop_evt.is_set():
        if _monitor_pause_evt.is_set() or not _serial_ok():
            time.sleep(0.03)
            continue
        try:
            with serial_lock:
                n = puerto_serial.in_waiting if hasattr(puerto_serial, 'in_waiting') else 0
                data = puerto_serial.read(n) if n and n > 0 else b''
            if data:
                try:
                    s = data.decode('ascii', errors='replace')
                except Exception:
                    s = repr(data)
                if _root_ref:
                    # postear al hilo de Tk
                    _root_ref.after(0, _rx_append, s)
            else:
                time.sleep(0.01)
        except Exception:
            time.sleep(0.05)

# ======================= INTERFAZ GRÁFICA =======================
def _start_app():
    global combo_puertos, label_estado, lbl_fb, lbl_lr, sliders_info, toggle_pos_btn
    global ascii_send_text, rx_text, rx_vsb, _root_ref

    root = tk.Tk()
    _root_ref = root
    root.title("Control de Servos Humanoide")

    # ----- Barra superior -----
    frame_top = tk.Frame(root); frame_top.pack(fill=tk.X, padx=10, pady=5)
    tk.Label(frame_top, text="Puerto:").pack(side=tk.LEFT)
    combo_puertos = ttk.Combobox(frame_top, values=puertos_disponibles(), width=15); combo_puertos.pack(side=tk.LEFT)
    tk.Button(frame_top, text="Refrescar", command=refrescar_puertos).pack(side=tk.LEFT, padx=5)
    tk.Button(frame_top, text="Conectar", command=conectar_serial).pack(side=tk.LEFT, padx=5)
    label_estado = tk.Label(frame_top, text="No conectado", fg="red"); label_estado.pack(side=tk.LEFT, padx=10)

    # ----- Motores DC (BTS7960) -----
    frame_motores = tk.LabelFrame(root, text="Motores DC (BTS7960)"); frame_motores.pack(fill=tk.X, padx=10, pady=5)

    # Motor A
    frmA = tk.Frame(frame_motores); frmA.pack(fill=tk.X, pady=2)
    varA = tk.StringVar(value="000")
    tk.Label(frmA, text="Motor A %:").pack(side=tk.LEFT)
    entryA = ttk.Entry(frmA, width=5, textvariable=varA); entryA.pack(side=tk.LEFT)
    tk.Button(frmA, text="A +", command=lambda: motor_cmd('A','+',varA.get())).pack(side=tk.LEFT, padx=3)
    tk.Button(frmA, text="A -", command=lambda: motor_cmd('A','-',varA.get())).pack(side=tk.LEFT, padx=3)
    tk.Label(frmA, text="Dir A:").pack(side=tk.LEFT, padx=(10,2))
    dirA_var = tk.StringVar(value='+')
    ttk.Combobox(frmA, textvariable=dirA_var, width=2, values=['+','-']).pack(side=tk.LEFT)

    # Motor B
    frmB = tk.Frame(frame_motores); frmB.pack(fill=tk.X, pady=2)
    varB = tk.StringVar(value="000")
    tk.Label(frmB, text="Motor B %:").pack(side=tk.LEFT)
    entryB = ttk.Entry(frmB, width=5, textvariable=varB); entryB.pack(side=tk.LEFT)
    tk.Button(frmB, text="B +", command=lambda: motor_cmd('B','+',varB.get())).pack(side=tk.LEFT, padx=3)
    tk.Button(frmB, text="B -", command=lambda: motor_cmd('B','-',varB.get())).pack(side=tk.LEFT, padx=3)
    tk.Label(frmB, text="Dir B:").pack(side=tk.LEFT, padx=(10,2))
    dirB_var = tk.StringVar(value='+')
    ttk.Combobox(frmB, textvariable=dirB_var, width=2, values=['+','-']).pack(side=tk.LEFT)

    tk.Button(frame_motores, text="PARADA (&S)", command=motores_parada).pack(side=tk.LEFT, padx=10)
    tk.Button(frame_motores,
              text="ACCIONAR AMBOS (&A &B)",
              command=lambda: motores_aplicar_ambos(dirA_var.get(), dirB_var.get(), varA.get(), varB.get())
             ).pack(side=tk.LEFT, padx=10)
    # HOME general y PARADA de servos
    tk.Button(frame_motores, text="HOME ($)", command=enviar_home).pack(side=tk.LEFT, padx=10)
    tk.Button(frame_motores, text="PARADA servos (|)", command=enviar_parada_servos_servos).pack(side=tk.LEFT, padx=10)
    # HOME parciales
    tk.Button(frame_motores, text="HOME Der (])", command=enviar_home_brazo_derecho).pack(side=tk.LEFT, padx=10)
    tk.Button(frame_motores, text="HOME Izq (%)", command=enviar_home_brazo_izquierdo).pack(side=tk.LEFT, padx=10)
    tk.Button(frame_motores, text="HOME Cabeza (\\)", command=enviar_home_cabeza).pack(side=tk.LEFT, padx=10)

    # ----- Sensores / Cabeza -----
    frame_sens = tk.LabelFrame(root, text="Sensores / Cabeza"); frame_sens.pack(fill=tk.X, padx=10, pady=5)
    tk.Button(frame_sens, text="Medir F/B (_)", command=medir_FB_instantaneo).pack(side=tk.LEFT, padx=5)
    tk.Button(frame_sens, text="Escaneo tilt (^) \n(espera patrón)", command=escaneo_tilt_minFB).pack(side=tk.LEFT, padx=5)
    tk.Button(frame_sens, text="Giro izq ([) \n(espera patrón)", command=giro_izq_medicion_LR).pack(side=tk.LEFT, padx=5)
    lbl_fb = tk.Label(frame_sens, text="F/B: (sin datos)"); lbl_fb.pack(side=tk.LEFT, padx=10)
    lbl_lr = tk.Label(frame_sens, text="L/R: (sin datos)"); lbl_lr.pack(side=tk.LEFT, padx=10)

    # ----- Scroll con dos columnas de sliders (0-15 izquierda, 16-31 derecha) -----
    canvas = tk.Canvas(root, height=620)
    scrollbar = tk.Scrollbar(root, orient="vertical", command=canvas.yview)
    outer = tk.Frame(canvas)
    outer.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
    canvas.create_window((0, 0), window=outer, anchor="nw")
    canvas.configure(yscrollcommand=scrollbar.set)
    canvas.pack(side="left", fill="both", expand=True)
    scrollbar.pack(side="right", fill="y")

    left_col = tk.Frame(outer)
    right_col = tk.Frame(outer)
    left_col.grid(row=0, column=0, sticky="nsew", padx=(8,4), pady=4)
    right_col.grid(row=0, column=1, sticky="nsew", padx=(4,8), pady=4)

    def _make_channel_widget(parent, canal):
        frame = tk.Frame(parent, relief=tk.RIDGE, borderwidth=1, padx=5, pady=5)
        tk.Label(frame, text=f"Canal {canal:02d}", width=10).pack(side=tk.LEFT)

        pwm_slider = tk.Scale(frame, from_=PWM_MIN, to=PWM_MAX, orient=tk.HORIZONTAL, length=220, resolution=10, label="PWM (µs)")
        pwm_slider.set(1500); pwm_slider.pack(side=tk.LEFT, padx=5)

        vel_var = tk.StringVar(value="01")
        vel_combo = ttk.Combobox(frame, textvariable=vel_var, width=3, values=[f"{i:02d}" for i in range(1, 11)])
        vel_combo.pack(side=tk.LEFT, padx=5)

        activo_var = tk.BooleanVar(value=True)
        tk.Checkbutton(frame, text="Activar", variable=activo_var).pack(side=tk.LEFT, padx=5)

        pwm_box = ttk.Entry(frame, width=6, state='readonly'); pwm_box.pack(side=tk.LEFT, padx=3)
        pwm_box.config(state='normal'); pwm_box.insert(0, '1500'); pwm_box.config(state='readonly')
        vel_box = ttk.Entry(frame, width=3, state='readonly'); vel_box.pack(side=tk.LEFT, padx=3)
        vel_box.config(state='normal'); vel_box.insert(0, '01'); vel_box.config(state='readonly')

        pwm_slider.config(command=lambda val, c=canal, p=pwm_slider, vv=vel_var, ac=activo_var, pb=pwm_box, vb=vel_box: actualizar_desde_pwm(c, p, vv, ac, pb, vb))
        vel_combo.bind('<<ComboboxSelected>>', lambda e, c=canal, vv=vel_var, vb=vel_box: on_vel_changed(e, c, vv, vb))

        sliders_info.append((canal, pwm_slider, vel_var, activo_var, pwm_box, vel_box, vel_combo))
        return frame

    for canal in range(NUM_CANALES):
        parent = left_col if canal < 16 else right_col
        w = _make_channel_widget(parent, canal)
        w.pack(fill=tk.X, padx=4, pady=3)

    # ----- Botonera inferior -----
    frame_bot = tk.Frame(root); frame_bot.pack(pady=10)
    tk.Button(frame_bot, text="Enviar Todos", command=enviar_todos).pack(side=tk.LEFT, padx=5)
    tk.Button(frame_bot, text="Leer Posiciones (.)", command=leer_posiciones).pack(side=tk.LEFT, padx=5)
    toggle_pos_btn = tk.Button(frame_bot, text="Mostrar tabla de posiciones", command=toggle_tabla_posiciones)
    toggle_pos_btn.pack(side=tk.LEFT, padx=5)

    # ASCII/TERM: envío y recepción (en vivo)
    ascii_frame = tk.LabelFrame(root, text="Enviar ASCII (crudo)"); ascii_frame.pack(fill=tk.BOTH, padx=10, pady=(0,5))
    ascii_send_text = tk.Text(ascii_frame, height=4, wrap="word")
    ascii_send_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(5,0), pady=5)
    send_btns = tk.Frame(ascii_frame); send_btns.pack(side=tk.RIGHT, fill=tk.Y, padx=5, pady=5)
    tk.Button(send_btns, text="Enviar ASCII", command=ascii_enviar).pack(side=tk.TOP, pady=(0,5))

    rx_frame = tk.LabelFrame(root, text="Recibido desde el microcontrolador (en vivo)"); rx_frame.pack(fill=tk.BOTH, padx=10, pady=(0,10))
    rx_text = tk.Text(rx_frame, height=8, wrap="word", state='disabled')
    rx_vsb = ttk.Scrollbar(rx_frame, orient="vertical", command=rx_text.yview)
    rx_text.configure(yscrollcommand=rx_vsb.set)
    rx_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(5,0), pady=5)
    rx_vsb.pack(side=tk.RIGHT, fill=tk.Y, padx=5, pady=5)

    rx_btns = tk.Frame(rx_frame); rx_btns.pack(side=tk.BOTTOM, fill=tk.X, padx=5, pady=(0,5))
    tk.Button(rx_btns, text="Leer disponibles", command=recibir_leer_disponibles).pack(side=tk.LEFT, padx=3)
    tk.Button(rx_btns, text="Limpiar", command=recibir_limpiar).pack(side=tk.LEFT, padx=3)

    root.mainloop()

if __name__ == '__main__':
    try:
        _start_app()
    except Exception as e:
        try:
            with open('gui_humanoide_error.log', 'w', encoding='utf-8') as f:
                traceback.print_exc(file=f)
        except:
            pass
        try:
            messagebox.showerror("Error", f"{e}")
        except:
            print(f"Error: {e}", file=sys.stderr)

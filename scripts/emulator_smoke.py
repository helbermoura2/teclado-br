"""Exercise actual keyboard touch events and capture both toolbar states."""
import pathlib
import re
import subprocess
import time
import xml.etree.ElementTree as ET

OUT = pathlib.Path("screenshots")
OUT.mkdir(exist_ok=True)

def adb(*args):
    return subprocess.check_output(["adb", *args])

def nodes():
    adb("shell", "uiautomator", "dump", "/sdcard/window.xml")
    return ET.fromstring(adb("shell", "cat", "/sdcard/window.xml")).iter("node")

def wait_for(description, attempts=8):
    for _ in range(attempts):
        for node in nodes():
            if node.get("content-desc") == description:
                return node
        time.sleep(1)
    screenshot("failure.png")
    (OUT / "failure-ui.xml").write_bytes(adb("shell", "cat", "/sdcard/window.xml"))
    (OUT / "logcat.txt").write_bytes(adb("logcat", "-d", "-t", "6000"))
    (OUT / "input-method.txt").write_bytes(adb("shell", "dumpsys", "input_method"))
    raise AssertionError(f"Missing control: {description}")

def tap(description):
    node = wait_for(description)
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.get("bounds")))
    adb("shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2))
    time.sleep(0.4)

def screenshot(name):
    (OUT / name).write_bytes(adb("exec-out", "screencap", "-p"))

adb("shell", "settings", "put", "secure", "show_ime_with_hard_keyboard", "1")
time.sleep(8)
print(adb("shell", "ime", "list", "-a").decode(), flush=True)
print(adb("shell", "ime", "enable", "br.com.tecladobr/.KeyboardService").decode(), flush=True)
print(adb("shell", "ime", "set", "br.com.tecladobr/.KeyboardService").decode(), flush=True)
adb("shell", "am", "start", "-n", "br.com.tecladobr/.PreviewActivity")
time.sleep(2)
print(adb("shell", "ime", "enable", "br.com.tecladobr/.KeyboardService").decode(), flush=True)
print(adb("shell", "ime", "set", "br.com.tecladobr/.KeyboardService").decode(), flush=True)
print("Selected:", adb("shell", "settings", "get", "secure", "default_input_method").decode(), flush=True)
for node in nodes():
    if node.get("class") == "android.widget.EditText":
        x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.get("bounds")))
        adb("shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2))
        break
wait_for("Mostrar sugestões")
screenshot("01-atalhos.png")
tap("E")
wait_for("Mostrar atalhos")
screenshot("02-sugestoes.png")
tap("Mostrar atalhos")
wait_for("Colar texto copiado")
tap("Mostrar sugestões")
wait_for("Mostrar atalhos")
tap("Apagar ou desfazer correção")
for label in ["V", "o", "c", "e", "Espaço; mantenha pressionado para trocar teclado"]:
    tap(label)
time.sleep(0.5)
assert any(n.get("text") == "Você " for n in nodes()), "Autocorrection failed"
tap(".")
tap("Espaço; mantenha pressionado para trocar teclado")
wait_for("E")
screenshot("03-correcao-maiuscula.png")
tap("Mostrar atalhos")
tap("Emojis")
wait_for("😀")
screenshot("04-emojis.png")
print("PASS: typing, toolbar toggling, autocorrection, capitalization, emoji popup")

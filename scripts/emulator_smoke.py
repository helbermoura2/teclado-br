"""Touch the IME on a fixed Pixel 5; UIAutomator exposes only the app window."""
import atexit
import pathlib
import re
import subprocess
import struct
import time
import xml.etree.ElementTree as ET

OUT = pathlib.Path('screenshots')
OUT.mkdir(exist_ok=True)

def adb(*args):
    return subprocess.check_output(['adb', *args], timeout=40)

def screenshot(name):
    (OUT/name).write_bytes(adb('exec-out', 'screencap', '-p'))

def diagnostics():
    screenshot('last-screen.png')
    (OUT/'logcat.txt').write_bytes(adb('logcat', '-d', '-t', '3000'))
    (OUT/'input-method.txt').write_bytes(adb('shell','dumpsys','input_method'))
atexit.register(diagnostics)

# Fix density, screen and navigation mode so tap coordinates have known geometry.
adb('shell','wm','size','1080x2340')
adb('shell','wm','density','440')
adb('shell','cmd','overlay','enable-exclusive','--category','com.android.internal.systemui.navbar.gestural')
adb('shell','settings','put','secure','show_ime_with_hard_keyboard','1')
time.sleep(8)
print(adb('shell','ime','enable','br.com.tecladobr/.KeyboardService').decode(),flush=True)
print(adb('shell','ime','set','br.com.tecladobr/.KeyboardService').decode(),flush=True)
adb('shell','am','start','-n','br.com.tecladobr/.PreviewActivity')
time.sleep(6)
adb('shell','ime','set','br.com.tecladobr/.KeyboardService')
adb('shell','input','tap','540','700')
time.sleep(3)

# Locate the toolbar in the actual rendered frame; navigation insets vary by image.
SCALE=2.75
TOP=None
for attempt in range(12):
    raw=adb('exec-out','screencap')
    width,height,fmt=struct.unpack_from('<III',raw)
    assert fmt==1, 'Expected RGBA screen'
    header=len(raw)-width*height*4
    for y in range(height//3,height):
        pixel=raw[header+(y*width+2)*4:header+(y*width+2)*4+3]
        if pixel in (bytes([23,23,25]),bytes([25,23,23])):
            TOP=y;break
    if TOP is not None:break
    time.sleep(1)
if TOP is None:
    (OUT/'screen.raw').write_bytes(raw)
    raise AssertionError('Dark keyboard toolbar not rendered')
print('Keyboard top:',TOP,flush=True)

def tap_dp(x,y):
    adb('shell','input','tap',str(round(x*SCALE)),str(round(TOP+y*SCALE)))
    time.sleep(0.6)

def letter(index,row=0):
    tap_dp(5+(index+0.5)*(393-10)/10,46+52+29+58*row)

def editor():
    for _ in range(4):
        adb('shell','uiautomator','dump','--compressed','/sdcard/window.xml')
        result=subprocess.run(['adb','shell','cat','/sdcard/window.xml'],capture_output=True)
        if result.returncode==0:
            tree=ET.fromstring(result.stdout)
            for n in tree.iter('node'):
                if n.get('class')=='android.widget.EditText':
                    return n.get('text','')
        time.sleep(1)
    raise AssertionError('Could not read editor')

screenshot('01-atalhos.png')
letter(2) # E
# Capture actual touch results; inspect screenshots alongside the text-engine tests.
screenshot('02-sugestoes.png')
tap_dp(25,23) # Open shortcuts.
screenshot('03-atalhos-reabertos.png')
tap_dp(25,23) # Return to suggestions.
tap_dp(365,46+52+58*2+29) # Backspace.
# V, o, c, e, Space -> Você
# Third row starts with a shift key (weight 1.35).
unit=(393-10)/9.7
tap_dp(5+unit*(1.35+3+0.5),46+52+58*2+29)
letter(8)
tap_dp(5+unit*(1.35+2+0.5),46+52+58*2+29)
letter(2)
tap_dp(185,46+52+58*3+29)
screenshot('04-autocorrecao.png')
tap_dp(313,46+52+58*3+29) # Period.
tap_dp(185,46+52+58*3+29)
letter(2)
# Capitalization is visible in the following capture.
screenshot('04-correcao-maiuscula.png')
tap_dp(25,23) # Shortcuts.
tap_dp(136,23) # Emoji icon.
screenshot('05-emojis.png')
fatal=adb('logcat','-d','-s','AndroidRuntime:E').decode()
assert 'br.com.tecladobr' not in fatal, 'Keyboard process crashed: '+fatal
print('PASS: screenshot smoke completed without app crash; inspect captures for touch behavior',flush=True)
# Open writing assistant after dismissing the emoji popup.
adb('shell','input','keyevent','4')
time.sleep(1)
adb('shell','input','text','voce%stem%sopcoes')
time.sleep(1)
tap_dp(196,23)
time.sleep(1)
screenshot('06-assistente-escrita.png')
# Panel geometry: 70 dp header, 244 dp scroll area and 54 dp navigation padding.
PANEL_TOP=2340-368*SCALE

def panel_tap(x,y):
    adb('shell','input','tap',str(round(x*SCALE)),str(round(PANEL_TOP+y*SCALE)))
    time.sleep(1)

panel_tap(65,157)
screenshot('07-revisao-basica.png')
panel_tap(290,35) # Back to main menu.
panel_tap(195,157)
screenshot('08-estilos-escrita.png')

# Return to the keyboard and exercise the native editor/clipboard end to end.
panel_tap(90,35)
time.sleep(1)
tap_dp(76,23) # Editing-tools icon in the shortcuts toolbar.
time.sleep(1)
original=editor()
assert original and original!='Experimente aqui', 'Missing sample text for clipboard test'
screenshot('09-barra-edicao.png')

def wait_editor(expected):
    actual=None
    for _ in range(5):
        actual=editor()
        if actual in expected:return actual
        time.sleep(1)
    raise AssertionError('Unexpected editor text: '+repr(actual))

tap_dp(74,23) # Select all.
screenshot('10-selecionar-tudo.png')
tap_dp(129,23) # Copy selection.
tap_dp(74,23) # Reselect in case the source app collapsed the selection after copying.
adb('shell','input','keyevent','67') # Delete selection without changing the clipboard.
wait_editor(['','Experimente aqui'])
tap_dp(239,23) # Paste copied text.
wait_editor([original])
tap_dp(74,23)
tap_dp(184,23) # Cut selection.
wait_editor(['','Experimente aqui'])
tap_dp(239,23)
wait_editor([original])
tap_dp(287,23) # Cursor left.
tap_dp(327,23) # Cursor right.
screenshot('11-copiar-recortar-colar.png')
tap_dp(26,23) # Return to shortcuts/suggestions.
screenshot('12-voltar-barra.png')
print('PASS: select-all, copy, cut and paste preserve the source text in the Android editor',flush=True)

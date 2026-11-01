#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
import pathlib
import subprocess
out=pathlib.Path('heli-results');out.mkdir(exist_ok=True)
package='br.com.tecladobr.heli.debug'
command=['adb','shell','am','instrument','-w', package+'/br.com.tecladobr.heli.testing.HeliTrialInstrumentation']
def run_phase(phase):
    cmd=command.copy()
    if phase!='full': cmd=['adb','shell','am','instrument','-w','-e','phase',phase,package+'/br.com.tecladobr.heli.testing.HeliTrialInstrumentation']
    try:
        run=subprocess.run(cmd,capture_output=True,text=True,timeout=600)
        log=run.stdout+run.stderr
    except subprocess.TimeoutExpired as failure:
        log='Instrumentation timed out\n'+str(failure)
    print(log,flush=True)
    (out/(phase+'-results.txt')).write_text(log)
    return log,'result=PASS' in log and 'INSTRUMENTATION_CODE: -1' in log
log,ok=run_phase('full')
if ok:
    # Reinstalling the exact same signed APK must retain app-private pins.
    apk=next(pathlib.Path('heli-package').rglob('*.apk'))
    subprocess.run(['adb','install','-r',str(apk)],check=True)
    second,ok=run_phase('verify_pins')
    log+='\nPROCESS RESTART / REINSTALL\n'+second
if ok:
    third,ok=run_phase('verify_ai_missing')
    log+='\nMISSING MODEL UI\n'+third
if ok:
    import os
    model=pathlib.Path(os.environ.get('AI_SMOKE_MODEL','/tmp/qwen-smoke.gguf'))
    if not model.is_file(): raise SystemExit('Offline model fixture is required')
    destination='/data/user/0/'+package+'/no_backup/offline-ai'
    subprocess.run(['adb','shell','run-as',package,'mkdir','-p',destination],check=True)
    with model.open('rb') as incoming:
        subprocess.run(['adb','exec-in','run-as',package,'dd','of='+destination+'/model.gguf','bs=1048576'],stdin=incoming,stdout=subprocess.DEVNULL,check=True)
    # Model is already local. Inference must work with device networking disabled.
    subprocess.run(['adb','shell','svc','wifi','disable'],check=True)
    subprocess.run(['adb','shell','svc','data','disable'],check=True)
    fourth,ok=run_phase('verify_ai')
    log+='\nOFFLINE NATIVE AI\n'+fourth
(out/'results.txt').write_text(log)
files=subprocess.run(['adb','shell','run-as',package,'ls','cache/heli-shots'],capture_output=True,text=True).stdout.splitlines()
for name in files:
    if name.endswith('.png'):
        data=subprocess.run(['adb','exec-out','run-as',package,'cat','cache/heli-shots/'+name],capture_output=True).stdout
        (out/name).write_bytes(data)
(out/'logcat.txt').write_bytes(subprocess.run(['adb','logcat','-d','-t','3000'],capture_output=True).stdout)
if not ok:raise SystemExit('HeliBoard interaction test failed')

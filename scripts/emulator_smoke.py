"""Run debug instrumentation: real overlapping pointer events against the keyboard."""
import pathlib, subprocess
out=pathlib.Path('screenshots');out.mkdir(exist_ok=True)
def adb(*args,timeout=600):
 return subprocess.run(['adb',*args],capture_output=True,timeout=timeout)
result=adb('shell','am','instrument','-w','br.com.tecladobr/.KeyboardStressInstrumentation')
report=result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace')
(out/'typing-results.txt').write_text(report);print(report,flush=True)
listing=adb('shell','run-as','br.com.tecladobr','ls','cache/typing-shots').stdout.decode().splitlines()
for name in listing:
 if name.endswith('.png'):
  capture=adb('exec-out','run-as','br.com.tecladobr','cat','cache/typing-shots/'+name)
  if capture.returncode==0:(out/name).write_bytes(capture.stdout)
(out/'logcat.txt').write_bytes(adb('logcat','-d','-t','2000').stdout)
if 'result=PASS' not in report or 'INSTRUMENTATION_CODE: -1' not in report:
 raise SystemExit('Android keyboard stress test failed; see typing-results.txt and screenshots')

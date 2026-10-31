#!/usr/bin/env python3
# Test-only key kept outside the repository and source archive.
import hashlib, json, os, pathlib, subprocess, tempfile, zipfile
root=pathlib.Path(__file__).resolve().parent
key=pathlib.Path.home()/'.android/debug.keystore'
key.parent.mkdir(parents=True,exist_ok=True)
expected_file=root/'signing-cert.sha256'
if not key.exists():
    repository=os.environ['GITHUB_REPOSITORY']
    query=f'repos/{repository}/actions/artifacts?name=teclado-br-heli-chave-teste-v1&per_page=100'
    artifacts=json.loads(subprocess.check_output(['gh','api',query]))['artifacts']
    available=sorted((a for a in artifacts if not a['expired']),key=lambda a:a['created_at'])
    if available:
        data=subprocess.check_output(['gh','api',f"repos/{repository}/actions/artifacts/{available[-1]['id']}/zip"])
        import io
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            name=next(n for n in archive.namelist() if n.endswith('debug.keystore'))
            key.write_bytes(archive.read(name))
    elif expected_file.exists():
        raise SystemExit('Chave de teste anterior indisponível. Restaurar backup; não gerar assinatura diferente.')
    else:
        subprocess.run(['keytool','-genkeypair','-keystore',str(key),'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=Teclado BR Teste,O=Desenvolvimento,C=BR','-keyalg','RSA','-keysize','2048','-validity','10000'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
os.chmod(key,0o600)
cert=subprocess.check_output(['keytool','-exportcert','-keystore',str(key),'-storepass','android','-alias','androiddebugkey'])
fingerprint=hashlib.sha256(cert).hexdigest()
if expected_file.exists() and expected_file.read_text().strip()!=fingerprint:
    raise SystemExit('Certificado não corresponde à assinatura de teste registrada.')
output=pathlib.Path('heli-artifacts');output.mkdir(exist_ok=True)
(output/'signing-cert.sha256').write_text(fingerprint+'\n')
print('Certificado de teste SHA-256:',fingerprint)

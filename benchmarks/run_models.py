"""Synthetic Portuguese quality probe. Timings are Linux CPU timings, NOT phone timings."""
import argparse, hashlib, json, os, pathlib, platform, shutil, subprocess, time
import urllib.request, urllib.parse, urllib.error

p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--name',required=True);args=p.parse_args()
OUT=pathlib.Path('benchmark-results')/args.name;OUT.mkdir(parents=True,exist_ok=True)
meta={'model':args.repo,'name':args.name,'quantization':'Q4_K_M','runner':platform.platform(),'cpu':subprocess.check_output(['lscpu'],text=True),'threads':2,'context':2048,'temperature':0,'seed':42,'max_tokens':180,'llama_cpp':'b6500','phone_benchmark':False,'cases':[]}

def request(url,data=None,timeout=180):
    req=urllib.request.Request(url,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json','User-Agent':'TecladoBR-synthetic-benchmark/1'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return json.load(r)

def save(): (OUT/'results.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))

def download(url,path):
    subprocess.run(['curl','--fail','--location','--retry','3','--max-time','600','--output',str(path),url],check=True)

try:
    info=request('https://huggingface.co/api/models/'+args.repo+'?blobs=true')
    revision=info['sha'];meta['revision']=revision
    siblings=info['siblings']
    options=[s for s in siblings if s['rfilename'].lower().endswith('.gguf') and 'q4_k_m' in s['rfilename'].lower()]
    convert=False
    if not options:
        options=[s for s in siblings if s['rfilename'].lower().endswith('.gguf') and 'q8_0' in s['rfilename'].lower()]
        convert=True
    if len(options)!=1:raise RuntimeError('Expected one Q4_K_M or Q8_0 file; got '+str([s['rfilename'] for s in options]))
    chosen=options[0];meta['source_file']=chosen['rfilename'];meta['source_lfs']=chosen.get('lfs')
    model=pathlib.Path('source.gguf')
    download('https://huggingface.co/'+args.repo+'/resolve/'+revision+'/'+urllib.parse.quote(chosen['rfilename'])+'?download=true',model)
    sha=hashlib.file_digest(model.open('rb'),'sha256').hexdigest();meta['source_sha256']=sha
    expected=chosen.get('lfs',{}).get('sha256')
    if expected and expected!=sha:raise RuntimeError('Model checksum mismatch')
    server=next(pathlib.Path('llama').rglob('llama-server'));server.chmod(0o755)
    env=os.environ.copy();env['LD_LIBRARY_PATH']=str(server.parent.resolve())+':'+env.get('LD_LIBRARY_PATH','')
    if convert:
        quantizer=next(pathlib.Path('llama').rglob('llama-quantize'));quantizer.chmod(0o755)
        with (OUT/'quantize.log').open('w') as log:subprocess.run([str(quantizer.resolve()),str(model),'model.gguf','Q4_K_M','2'],env=env,stdout=log,stderr=log,check=True)
        model.unlink();model=pathlib.Path('model.gguf')
    meta['model_bytes']=model.stat().st_size;meta['model_sha256']=hashlib.file_digest(model.open('rb'),'sha256').hexdigest();save()
    log=(OUT/'server.log').open('w')
    proc=subprocess.Popen([str(server.resolve()),'-m',str(model.resolve()),'-c','2048','-t','2','-tb','2','-ngl','0','--host','127.0.0.1','--port','8080','--jinja'],env=env,stdout=log,stderr=log)
    try:
        for _ in range(120):
            if proc.poll() is not None:raise RuntimeError('llama-server exited: '+str(proc.returncode))
            try:
                if request('http://127.0.0.1:8080/health',timeout=2).get('status')=='ok':break
            except Exception:pass
            time.sleep(1)
        else:raise RuntimeError('Server startup timeout')
        for case in json.loads(pathlib.Path('benchmarks/cases.json').read_text()):
            body={'messages':[{'role':'system','content':'Você é um assistente de escrita em português brasileiro. Siga o pedido e preserve os fatos.'},{'role':'user','content':case['task']+'\n\n'+case['text']}],'temperature':0,'seed':42,'max_tokens':180,'cache_prompt':False,'chat_template_kwargs':{'enable_thinking':False},'stream':False}
            began=time.monotonic()
            try:
                result=request('http://127.0.0.1:8080/v1/chat/completions',body)
                item={**case,'elapsed_seconds':round(time.monotonic()-began,3),'output':result['choices'][0]['message'].get('content'),'reasoning_content':result['choices'][0]['message'].get('reasoning_content'),'finish_reason':result['choices'][0].get('finish_reason'),'usage':result.get('usage'),'timings':result.get('timings'),'request':body}
            except Exception as e:item={**case,'error':str(e),'elapsed_seconds':round(time.monotonic()-began,3)}
            meta['cases'].append(item);save();print(args.name,case['id'],'completed',flush=True)
        status=pathlib.Path('/proc')/str(proc.pid)/'status'
        meta['memory_status']=status.read_text() if status.exists() else None
        meta['status']='completed';save()
    finally:
        proc.terminate()
        try:proc.wait(timeout=10)
        except subprocess.TimeoutExpired:proc.kill();proc.wait()
        log.close()
except Exception as e:
    meta['status']='failed';meta['error']=str(e);save();raise

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { PROJECT } from '../config/project';
import type { Manifest, ModelVersion } from '../lib/manifest';
import type { SceneMeta } from '../pipeline/meta';
import type { WorkerMessage, WorkerRequest } from './processWorker';
import { validate, type Check } from './validate';

const TOKEN_KEY = 'cjx-admin';

async function api<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `Erro ${r.status}`);
  return data as T;
}

const fmtBytes = (n?: number) => (n ? `${(n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : '—');
const fmtDate = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const STATUS: Record<ModelVersion['status'], string> = { publicado: 'No ar', previa: 'Prévia', arquivado: 'Anterior' };

/** Área administrativa: atualizar o modelo 3D sem recompilar o app. */
export function Admin() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  if (!token) return <Login onLogin={(t) => { sessionStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;
  return <Dashboard token={token} onLogout={() => { sessionStorage.removeItem(TOKEN_KEY); setToken(null); }} />;
}

function Login({ onLogin }: { onLogin: (t: string) => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const { token } = await api<{ token: string }>('/api/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
      onLogin(token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin admin-center">
      <form className="admin-card admin-login" onSubmit={submit}>
        <div className="eyebrow">Área administrativa</div>
        <h1 className="serif">{PROJECT.name}</h1>
        <label className="field">
          <span>Senha</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="current-password" />
        </label>
        {err && <p className="admin-error">{err}</p>}
        <button className="btn-primary btn-wide" disabled={!pw || busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <a className="link" href="/">Voltar para a visita</a>
      </form>
    </div>
  );
}

type Stage = 'idle' | 'processing' | 'review' | 'uploading' | 'done' | 'error';

interface Result { glb: ArrayBuffer; meta: SceneMeta; stats: { triangles: number; inputBytes: number; outputBytes: number } }

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [currentMeta, setCurrentMeta] = useState<SceneMeta | null>(null);
  const [msg, setMsg] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState({ step: '', value: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);

  const reload = useCallback(async () => {
    try {
      const m = await api<Manifest>('/api/manifest');
      setManifest(m);
      const cur = m.versions.find((v) => v.id === m.current);
      if (cur) {
        const metaUrl = cur.url.replace(/\.glb(\?.*)?$/, '.meta.json');
        const r = await fetch(metaUrl);
        if (r.ok) setCurrentMeta(await r.json());
      }
    } catch (e) {
      setMsg(`Não foi possível ler as versões: ${e instanceof Error ? e.message : e}`);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => () => worker.current?.terminate(), []);

  const isSkp = modelFile && /\.skp$/i.test(modelFile.name);
  const checks: Check[] = useMemo(() => (result ? validate(result.meta, currentMeta) : []), [result, currentMeta]);
  const blocking = checks.some((c) => c.level === 'erro');

  const process = async () => {
    if (!modelFile || isSkp) return;
    setStage('processing');
    setError('');
    setLog([]);
    setResult(null);
    worker.current?.terminate();
    const w = new Worker(new URL('./processWorker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data;
      if (m.type === 'log') setLog((l) => [...l, m.text]);
      else if (m.type === 'progress') setProgress({ step: m.step, value: m.value });
      else if (m.type === 'done') {
        setResult({ glb: m.glb, meta: m.meta as SceneMeta, stats: m.stats });
        setStage('review');
        w.terminate();
      } else if (m.type === 'error') {
        setError(m.text);
        setStage('error');
        w.terminate();
      }
    };
    w.onerror = (e) => {
      setError(e.message || 'Falha no processamento (memória insuficiente no navegador?).');
      setStage('error');
    };
    const req: WorkerRequest = { model: await modelFile.arrayBuffer(), fileName: modelFile.name, textures: zipFile ? await zipFile.arrayBuffer() : undefined };
    w.postMessage(req, [req.model, ...(req.textures ? [req.textures] : [])]);
  };

  const send = async () => {
    if (!result || !modelFile) return;
    setStage('uploading');
    setError('');
    try {
      const id = `v${new Date().toISOString().replace(/\D/g, '').slice(0, 12)}`;
      const payload = JSON.stringify({ token });
      setProgress({ step: 'Enviando o modelo', value: 0 });
      const glb = await upload(`modelos/${id}/model.glb`, new Blob([result.glb], { type: 'model/gltf-binary' }), {
        access: 'public', handleUploadUrl: '/api/upload', clientPayload: payload, multipart: true, contentType: 'model/gltf-binary',
        onUploadProgress: (p) => setProgress({ step: 'Enviando o modelo', value: p.percentage / 100 }),
      });
      await upload(`modelos/${id}/model.meta.json`, new Blob([JSON.stringify(result.meta)], { type: 'application/json' }), {
        access: 'public', handleUploadUrl: '/api/upload', clientPayload: payload, contentType: 'application/json',
      });
      const version: ModelVersion = {
        id, url: glb.url, fileName: modelFile.name, createdAt: new Date().toISOString(), status: 'previa', sizeBytes: result.stats.outputBytes, notes,
        stats: { rooms: result.meta.rooms.length, doors: result.meta.doors.length, materials: result.meta.materials.length },
      };
      const m = await api<Manifest>('/api/manifest', { method: 'POST', body: JSON.stringify({ action: 'add', version }) }, token);
      setManifest(m);
      setStage('done');
      setMsg('Prévia criada. Abra a prévia, confira e só então publique.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('review');
    }
  };

  const act = async (action: 'publish' | 'archive' | 'delete', v: ModelVersion) => {
    const text = {
      publish: `Publicar a versão de ${fmtDate(v.createdAt)}? Os clientes passarão a ver este modelo. A versão atual fica guardada e pode ser restaurada.`,
      archive: 'Arquivar esta versão?',
      delete: 'Excluir esta prévia? O arquivo será apagado.',
    }[action];
    if (!confirm(text)) return;
    try {
      const m = await api<Manifest>('/api/manifest', { method: 'POST', body: JSON.stringify({ action, id: v.id }) }, token);
      setManifest(m);
      setMsg(action === 'publish' ? 'Versão publicada. A visita já mostra o novo modelo.' : 'Pronto.');
      if (action === 'publish') reload();
    } catch (e) {
      if (/restrito/.test(String(e))) onLogout();
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const reset = () => { setStage('idle'); setResult(null); setModelFile(null); setZipFile(null); setNotes(''); setLog([]); setError(''); };

  return (
    <div className="admin">
      <header className="admin-top">
        <div>
          <div className="eyebrow">Área administrativa</div>
          <h1 className="serif">{PROJECT.name}</h1>
        </div>
        <div className="row">
          <a className="btn-ghost" href="/" target="_blank" rel="noreferrer">Abrir visita</a>
          <button className="btn-ghost" onClick={onLogout}>Sair</button>
        </div>
      </header>
      {msg && <div className="admin-msg" onClick={() => setMsg('')}>{msg}</div>}

      <section className="admin-card">
        <h2>Atualizar modelo 3D</h2>
        <p className="muted">
          Envie o modelo exportado do SketchUp em <b>GLB</b> (mesmo exportador usado hoje, com texturas). O processamento acontece neste
          navegador; a arquitetura não é alterada: só materiais, organização das malhas e compressão. A nova versão entra como prévia e só vai ao
          ar depois que você confirmar.
        </p>
        {(stage === 'idle' || stage === 'error') && (
          <>
            <div className="admin-files">
              <label className="admin-drop">
                <input type="file" accept=".glb,.gltf,.skp" onChange={(e) => setModelFile(e.target.files?.[0] ?? null)} />
                <b>{modelFile ? modelFile.name : 'Escolher modelo (.glb)'}</b>
                <span className="muted">{modelFile ? fmtBytes(modelFile.size) : 'Obrigatório'}</span>
              </label>
              <label className="admin-drop">
                <input type="file" accept=".zip" onChange={(e) => setZipFile(e.target.files?.[0] ?? null)} />
                <b>{zipFile ? zipFile.name : 'Texturas em alta (.zip)'}</b>
                <span className="muted">{zipFile ? fmtBytes(zipFile.size) : 'Opcional'}</span>
              </label>
            </div>
            {isSkp && (
              <div className="admin-warn">
                Arquivos .skp não podem ser lidos fora do SketchUp: o formato é fechado e só abre com o kit de desenvolvimento da Trimble,
                que não roda em servidores web. No SketchUp, exporte o modelo como <b>GLB (glTF binário)</b> com as texturas e envie esse arquivo.
                Mantenha os nomes dos pisos (“PISO - QUARTO…”) e as portas como grupos separados, para que ambientes e animações continuem funcionando.
              </div>
            )}
            {/\.gltf$/i.test(modelFile?.name ?? '') && <div className="admin-warn">Arquivos .gltf dependem de arquivos externos. Prefira exportar em .glb (tudo num arquivo só).</div>}
            <label className="field">
              <span>Observações da versão</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex.: ajuste na fachada da casa 2" />
            </label>
            {error && <p className="admin-error">{error}</p>}
            <button className="btn-primary" disabled={!modelFile || !!isSkp || /\.gltf$/i.test(modelFile?.name ?? '')} onClick={process}>Validar e processar</button>
          </>
        )}

        {(stage === 'processing' || stage === 'uploading') && (
          <div className="admin-progress">
            <div className="row"><b>{progress.step || 'Preparando…'}</b><span className="muted">{Math.round(progress.value * 100)}%</span></div>
            <div className="bar"><i style={{ width: `${Math.max(3, progress.value * 100)}%` }} /></div>
            <p className="muted">Mantenha esta aba aberta. Modelos grandes levam alguns minutos.</p>
          </div>
        )}

        {log.length > 0 && stage !== 'idle' && (
          <details className="admin-log" open={stage === 'processing'}>
            <summary>Registro do processamento</summary>
            <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </details>
        )}

        {result && (stage === 'review' || stage === 'uploading') && (
          <div className="admin-review">
            <h3>Validação</h3>
            <div className="admin-stats">
              <div><b>{result.meta.rooms.length}</b><span>ambientes</span></div>
              <div><b>{result.meta.doors.length}</b><span>portas animáveis</span></div>
              <div><b>{result.stats.triangles.toLocaleString('pt-BR')}</b><span>triângulos</span></div>
              <div><b>{fmtBytes(result.stats.outputBytes)}</b><span>arquivo final (era {fmtBytes(result.stats.inputBytes)})</span></div>
            </div>
            <ul className="admin-checks">
              {checks.map((c, i) => <li key={i} className={c.level}><b>{c.level === 'ok' ? '✓' : c.level === 'aviso' ? '!' : '✕'}</b> {c.text}</li>)}
            </ul>
            {error && <p className="admin-error">{error}</p>}
            <div className="row">
              <button className="btn-ghost" onClick={reset} disabled={stage === 'uploading'}>Cancelar</button>
              <button className="btn-primary" onClick={send} disabled={blocking || stage === 'uploading'}>Enviar como prévia</button>
            </div>
          </div>
        )}
        {stage === 'done' && <button className="btn-ghost" onClick={reset}>Enviar outro arquivo</button>}
      </section>

      <section className="admin-card">
        <h2>Versões do modelo</h2>
        <p className="muted">Todas as versões ficam guardadas. Para voltar a uma anterior, publique-a de novo. Personalizações e links compartilhados continuam valendo enquanto os nomes dos ambientes e materiais forem os mesmos.</p>
        <div className="admin-table">
          {manifest?.versions.map((v) => (
            <div key={v.id} className={`admin-ver ${v.status}`}>
              <div>
                <b>{fmtDate(v.createdAt)}</b> <span className={`tag ${v.status}`}>{STATUS[v.status]}</span>
                <div className="muted">{v.fileName} · {fmtBytes(v.sizeBytes)}{v.stats ? ` · ${v.stats.rooms} ambientes, ${v.stats.doors} portas` : ''}</div>
                {v.notes && <div className="muted">{v.notes}</div>}
              </div>
              <div className="row">
                <a className="btn-ghost" href={`/?modelo=${encodeURIComponent(v.url)}`} target="_blank" rel="noreferrer">Pré-visualizar</a>
                {v.status !== 'publicado' && <button className="btn-primary" onClick={() => act('publish', v)}>{v.status === 'arquivado' ? 'Restaurar' : 'Publicar'}</button>}
                {v.status === 'previa' && <button className="btn-ghost" onClick={() => act('delete', v)}>Excluir</button>}
              </div>
            </div>
          ))}
          {!manifest && <p className="muted">Carregando…</p>}
        </div>
      </section>
    </div>
  );
}

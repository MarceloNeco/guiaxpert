/* GuiaXpert — reconhecimento de voz no próprio aparelho (Whisper base, código aberto), para o computador onde o
   serviço de voz do navegador não responde. Roda num worker para a tela não travar. O modelo (≈77 MB) vem uma vez
   do Hugging Face e fica guardado no navegador; depois funciona sem internet. O áudio nunca sai do aparelho.
   Mensagens: {tipo:'carregar'} → {tipo:'progresso', pct} … {tipo:'pronto'}; {tipo:'transcrever', id, audio, lingua} → {tipo:'texto', id, texto}. */
import { pipeline, env } from './transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = new URL('./', import.meta.url).href;   /* runtime guardado no próprio app */
env.backends.onnx.wasm.numThreads = 1;                                      /* GitHub Pages não libera várias threads */

const MODELOS = { normal: 'onnx-community/whisper-base', preciso: 'onnx-community/whisper-small' };
let pronto = null, modeloAtual = 'normal';
const arquivos = {};

function carregar(modelo) {
  if (modelo && MODELOS[modelo] && modelo !== modeloAtual) { modeloAtual = modelo; pronto = null; }
  if (pronto) return pronto;
  pronto = pipeline('automatic-speech-recognition', MODELOS[modeloAtual], {
    dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    device: 'wasm',
    progress_callback: (p) => {
      if (p.status === 'progress' && p.file) {
        arquivos[p.file] = { c: p.loaded || 0, t: p.total || 0 };
        let c = 0, t = 0; Object.values(arquivos).forEach((a) => { c += a.c; t += a.t; });
        if (t) self.postMessage({ tipo: 'progresso', pct: Math.round(c / t * 100), mb: Math.round(c / 1048576), mbTotal: Math.round(t / 1048576) });
      }
    },
  }).then((p) => { self.postMessage({ tipo: 'pronto' }); return p; }, (e) => { pronto = null; self.postMessage({ tipo: 'falhou', erro: String((e && e.message) || e).slice(0, 200) }); throw e; });
  return pronto;
}

self.onmessage = async (ev) => {
  const m = ev.data || {};
  try {
    if (m.tipo === 'carregar') { await carregar(m.modelo).catch(() => {}); return; }
    if (m.tipo === 'transcrever') {
      const asr = await carregar(m.modelo);
      const r = await asr(m.audio, { language: m.lingua || 'portuguese', task: 'transcribe', chunk_length_s: 30 });
      self.postMessage({ tipo: 'texto', id: m.id, texto: String((r && r.text) || '').trim() });
    }
  } catch (e) {
    self.postMessage({ tipo: 'erro', id: m.id, erro: String((e && e.message) || e).slice(0, 200) });
  }
};

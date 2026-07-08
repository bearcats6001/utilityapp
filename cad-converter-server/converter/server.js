import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const app = express();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 75) * 1024 * 1024 } });
const PORT = process.env.PORT || 8080;

app.use(cors());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'cad-converter' }));
app.post(['/convert', '/api/convert-cad'], upload.single('file'), async (req, res) => {
  const input = req.file?.path;
  const original = req.file?.originalname || 'drawing';
  const ext = path.extname(original).toLowerCase().replace('.', '');
  const job = crypto.randomUUID();
  const output = path.join(os.tmpdir(), `${job}.dxf`);

  try {
    if (!input) throw new Error('No file was uploaded.');
    if (!['dwg', 'dgn'].includes(ext)) throw new Error('Converter only accepts DWG or DGN. DXF should be loaded directly in the viewer.');

    await convertToDxf({ input, output, ext, original });
    const dxf = await fs.readFile(output, 'utf8');
    if (!dxf.trim()) throw new Error('The converter returned an empty DXF.');

    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${safeBaseName(original)}.dxf"`);
    res.send(dxf);
  } catch (err) {
    console.error('CAD conversion failed:', err);
    res.status(500).json({ error: err.message || String(err) });
  } finally {
    await Promise.allSettled([input && fs.rm(input, { force: true }), fs.rm(output, { force: true })]);
  }
});

async function convertToDxf({ input, output, ext, original }) {
  // Best option for production: set CAD_CONVERTER_COMMAND to a converter you control.
  // Example: CAD_CONVERTER_COMMAND='ogr2ogr -f DXF {output} {input}'
  // Placeholders available: {input}, {output}, {ext}, {original}
  if (process.env.CAD_CONVERTER_COMMAND) {
    const cmd = fillCommand(process.env.CAD_CONVERTER_COMMAND, { input, output, ext, original });
    await runShell(cmd);
    return;
  }

  // Default fallback. This works for DGN when the server GDAL build supports it.
  // DWG and DGN V8 commonly require a GDAL build with ODA/Teigha support or a custom converter command.
  await run('ogr2ogr', ['-f', 'DXF', output, input]);
}

function fillCommand(template, vars) {
  return template.replace(/\{(input|output|ext|original)\}/g, (_m, k) => shellQuote(vars[k]));
}
function shellQuote(v) { return `'${String(v).replace(/'/g, `'\\''`)}'`; }
function runShell(command) { return run('/bin/sh', ['-lc', command]); }
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CAD conversion timed out.')); }, Number(process.env.CONVERT_TIMEOUT_MS || 120000));
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} failed with code ${code}. ${stderr || stdout || ''}`.trim()));
    });
  });
}
function safeBaseName(name) { return path.basename(name, path.extname(name)).replace(/[^a-z0-9._-]+/gi, '_'); }

app.listen(PORT, () => console.log(`CAD converter listening on :${PORT}`));

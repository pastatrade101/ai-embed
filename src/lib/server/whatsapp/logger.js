// Structured, single-line JSON logging for the WhatsApp module. Goes to stdout/stderr
// so it lands in `docker compose logs` and any log shipper. Access tokens and other
// secrets are redacted before anything is written.
const SCOPE = 'whatsapp';
const SECRET_KEYS = /access[_-]?token|authorization|app[_-]?secret|verify[_-]?token|bearer/i;

function redact(value) {
	if (!value || typeof value !== 'object') return value;
	if (Array.isArray(value)) return value.map(redact);
	const out = {};
	for (const [k, v] of Object.entries(value)) {
		out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v);
	}
	return out;
}

function emit(level, event, data) {
	const line = { ts: new Date().toISOString(), scope: SCOPE, level, event };
	if (data !== undefined) line.data = redact(data);
	const str = JSON.stringify(line);
	if (level === 'error') console.error(str);
	else if (level === 'warn') console.warn(str);
	else console.log(str);
}

export const log = {
	info: (event, data) => emit('info', event, data),
	warn: (event, data) => emit('warn', event, data),
	error: (event, data) => emit('error', event, data)
};

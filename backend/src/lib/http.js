export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new HttpError(400, 'Validation failed', result.error.flatten().fieldErrors));
  }
  req.body = result.data;
  next();
};

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'Route not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message;
  if (err.code === 'P2002') { status = 409; message = 'A record with these values already exists'; }
  if (err.code === 'P2025') { status = 404; message = 'Record not found'; }
  if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON body'; }
  if (status >= 500) {
    console.error(err);
    message = 'Internal server error';
  }
  res.status(status).json({ error: message, details: err.details });
}

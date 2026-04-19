const success = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const created = (res, data = {}, message = 'Created successfully') => {
  return success(res, data, message, 201);
};

const error = (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

const badRequest = (res, message = 'Bad request', errors = null) =>
  error(res, message, 400, errors);

const unauthorized = (res, message = 'Unauthorized') =>
  error(res, message, 401);

const forbidden = (res, message = 'Forbidden') =>
  error(res, message, 403);

const notFound = (res, message = 'Not found') =>
  error(res, message, 404);

const conflict = (res, message = 'Conflict') =>
  error(res, message, 409);

const paginated = (res, rows, total, page, limit) => {
  return res.status(200).json({
    success: true,
    data: rows,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  });
};

module.exports = { success, created, error, badRequest, unauthorized, forbidden, notFound, conflict, paginated };

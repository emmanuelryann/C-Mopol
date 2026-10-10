/**
 * Standardised success-response wrapper.
 *
 * Every successful API response follows the shape:
 * {
 *   success: true,
 *   message: "...",
 *   data:    { ... }
 * }
 */
class ApiResponse {
  /**
   * @param {number} statusCode – HTTP status code (2xx)
   * @param {string} message    – Human-readable success message
   * @param {*}      [data=null] – Payload returned to the client
   */
  constructor(statusCode, message, data = null) {
    this.success = true;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }

  /**
   * Sends this response on the given Express `res` object.
   * @param {import('express').Response} res
   */
  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
    });
  }
}

export default ApiResponse;

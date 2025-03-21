export default class FacilityErrorHandler {
   constructor (socket) {
      this.socket = socket
   }

   handleError(error, source = 'Unknown') {
      const errorData = this.classifyError(error, source);

      // Log the error for debugging
      console.error(`[${errorData.type}] ${errorData.message}`);

      // Send the error to the frontend via WebSocket
      this.socket.broadcastMessage('monitor', { type: 'error', data: errorData });
   }

   classifyError(error, source) {
      let errorType = 'Unknown Error';
      let message = 'An unknown error occurred.';

      if (error.response) {
          // Errors from Axios HTTP requests
          errorType = 'HTTP Error';
          message = `(${source}) ${error.response.status}: ${error.response.data}`;
      } else if (error.code) {
          // Errors from Node.js (like network errors)
          errorType = 'System Error';
          message = `(${source}) ${error.code}: ${error.message}`;
      } else if (error instanceof TypeError) {
          // JavaScript runtime errors
          errorType = 'Runtime Error';
          message = `(${source}) Type Error: ${error.message}`;
      } else {
          // Fallback for unknown errors
          message = `(${source}) ${error.message}`;
      }

      return { type: errorType, message, source };
  }
}
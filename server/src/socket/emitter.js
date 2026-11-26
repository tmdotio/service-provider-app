/**
 * Tiny bridge so services can push events without importing the socket
 * server (keeps tests and scripts working when no socket is running).
 */
let io = null;

export const setIO = (server) => {
  io = server;
};

export const getIO = () => io;

/** Every socket of a user joins the room "user:<id>" (all their tabs/devices). */
export const roomOf = (userId) => `user:${String(userId?._id || userId)}`;

/** Close every live connection of a user (deactivated or deleted by an admin). */
export const disconnectUser = (userId) => {
  if (io && userId) io.in(roomOf(userId)).disconnectSockets(true);
};

export const emitToUser = (userId, event, data) => {
  if (io && userId) io.to(roomOf(userId)).emit(event, data);
};

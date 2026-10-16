/**
 * Host half of the Pomodoro bundle.
 *
 * The whole feature lives in the browser half (`./client`): a sidebar page and
 * a composer dock pill. This row exists so the loader entry makes the client
 * bundle part of the module graph, so it stays a no-op — the plugin provides no
 * Host service, reads no session data, and registers no tool.
 * @module dsh-pomodoro-timer
 */
export function apply() {}

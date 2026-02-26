import { createContext, useContext } from 'react';

/**
 * Tracks whether the Tiptap editor is currently in edit mode.
 *
 * Provided by PageEditor and consumed by all ReactNodeViewRenderer-based atom
 * node views. React portals (used internally by tiptap-react) preserve the
 * React context tree, so context from PageEditor is available in all node views
 * without any extra wiring.
 *
 * This replaces the previous `editor.on('transaction', sync)` approach, which
 * was unreliable because `editor.setEditable()` calls `view.setProps()` — it
 * does NOT dispatch a ProseMirror transaction and therefore does NOT fire the
 * Tiptap `transaction` event.
 */
export const EditableContext = createContext<boolean>(false);

export const useEditable = () => useContext(EditableContext);

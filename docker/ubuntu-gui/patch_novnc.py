import sys

target_file = "/usr/share/novnc/app/ui.js"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

if "KALI_CLIPBOARD_SYNC" in content:
    print("SUCCESS: noVNC ui.js is already patched.")
    sys.exit(0)

# 1. Enhance clipboardReceive with auto-sync to navigator.clipboard and window.parent
old_clipboard_receive = """    clipboardReceive(e) {
        Log.Debug(">> UI.clipboardReceive: " + e.detail.text.substr(0, 40) + "...");
        document.getElementById('noVNC_clipboard_text').value = e.detail.text;
        Log.Debug("<< UI.clipboardReceive");
    },"""

new_clipboard_receive = """    clipboardReceive(e) {
        Log.Debug(">> UI.clipboardReceive: " + e.detail.text.substr(0, 40) + "...");
        const clipText = e.detail.text;
        const textElem = document.getElementById('noVNC_clipboard_text');
        if (textElem) {
            textElem.value = clipText;
        }

        // 1. Attempt to write to modern browser clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(clipText).catch(() => {});
        }

        // 2. Transmit to parent container/window (Cyber Range iframe host)
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'KALI_CLIPBOARD_SYNC',
                    text: clipText
                }, '*');
            }
        } catch (_) {}

        Log.Debug("<< UI.clipboardReceive");
    },"""

# 2. Enhance addClipboardHandlers to receive postMessage from parent and listen to paste events
old_add_handlers = """    addClipboardHandlers() {
        document.getElementById("noVNC_clipboard_button")
            .addEventListener('click', UI.toggleClipboardPanel);
        document.getElementById("noVNC_clipboard_text")
            .addEventListener('change', UI.clipboardSend);
    },"""

new_add_handlers = """    addClipboardHandlers() {
        document.getElementById("noVNC_clipboard_button")
            .addEventListener('click', UI.toggleClipboardPanel);
        document.getElementById("noVNC_clipboard_text")
            .addEventListener('change', UI.clipboardSend);

        // Bi-directional Bridge: Receive clipboard paste from Cyber Range host
        window.addEventListener('message', (ev) => {
            if (ev.data && (ev.data.type === 'KALI_CLIPBOARD_PASTE' || ev.data.type === 'VNC_CLIPBOARD_SEND')) {
                const text = ev.data.text;
                if (typeof text === 'string' && UI.rfb) {
                    UI.rfb.clipboardPasteFrom(text);
                    const textElem = document.getElementById('noVNC_clipboard_text');
                    if (textElem) textElem.value = text;
                }
            }
        });

        // Capture standard Ctrl+V / paste event on the canvas or window
        window.addEventListener('paste', (ev) => {
            if (ev.target && (ev.target.tagName === 'TEXTAREA' || ev.target.tagName === 'INPUT')) {
                return;
            }
            const pasteText = (ev.clipboardData || window.clipboardData)?.getData('text');
            if (pasteText && UI.rfb) {
                UI.rfb.clipboardPasteFrom(pasteText);
                const textElem = document.getElementById('noVNC_clipboard_text');
                if (textElem) textElem.value = pasteText;
            }
        });
    },"""

# 3. Enhance updateVisualState to emit VNC_STATUS to parent cyber range frame
old_visual_state = """    updateVisualState(state) {

        document.documentElement.classList.remove("noVNC_connecting");"""

new_visual_state = """    updateVisualState(state) {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'VNC_STATUS', state: state }, '*');
            }
        } catch (_) {}

        document.documentElement.classList.remove("noVNC_connecting");"""

if old_clipboard_receive in content and old_add_handlers in content:
    content = content.replace(old_clipboard_receive, new_clipboard_receive)
    content = content.replace(old_add_handlers, new_add_handlers)
    if old_visual_state in content:
        content = content.replace(old_visual_state, new_visual_state)
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Successfully patched noVNC ui.js for bi-directional clipboard & status telemetry!")
else:
    print("WARNING: Exact strings not matched, attempting fallback regex patching...")
    import re
    # Fallback patch for clipboardReceive
    pattern_recv = r'clipboardReceive\(e\)\s*\{[^}]*Log\.Debug\("<< UI\.clipboardReceive"\);\s*\},'
    if re.search(pattern_recv, content):
        content = re.sub(pattern_recv, new_clipboard_receive[4:], content)
    
    # Fallback patch for addClipboardHandlers
    pattern_hand = r'addClipboardHandlers\(\)\s*\{[^}]*addEventListener\(\'change\',\s*UI\.clipboardSend\);\s*\},'
    if re.search(pattern_hand, content):
        content = re.sub(pattern_hand, new_add_handlers[4:], content)

    # Fallback patch for updateVisualState
    pattern_state = r'updateVisualState\(state\)\s*\{\s*document\.documentElement'
    if re.search(pattern_state, content):
        content = re.sub(pattern_state, 'updateVisualState(state) {\n        try {\n            if (window.parent && window.parent !== window) {\n                window.parent.postMessage({ type: \'VNC_STATUS\', state: state }, \'*\');\n            }\n        } catch (_) {}\n        document.documentElement', content)

    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Patched via fallback regex!")


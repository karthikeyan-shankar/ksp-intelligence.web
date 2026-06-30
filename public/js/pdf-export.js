/**
 * ═══════════════════════════════════════════════════
 *  KSP Crime Intelligence — PDF Export
 *  Exports chat transcript as printable HTML report
 *  with KSP branding, timestamps, and officer info.
 * ═══════════════════════════════════════════════════
 */

const KSPExport = (() => {

    /**
     * Export the current chat as a printable report.
     * Opens in a new window with print dialog.
     * 
     * @param {Array} messages - Array of { role, content, time } objects
     * @param {Object} user    - { name, role, username }
     * @param {string} sessionId - Current session ID
     */
    function exportChat(messages, user, sessionId) {
        if (!messages || messages.length === 0) {
            alert('No messages to export.');
            return;
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit'
        });

        const officerName = user?.name || 'Unknown Officer';
        const officerRole = user?.role || 'N/A';

        // Build message rows
        const messageRows = messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const senderLabel = isUser ? officerName : 'KSP AI Assistant';
            const senderClass = isUser ? 'sender-user' : 'sender-ai';
            const timeLabel = msg.time || '';

            // Escape HTML in content
            const safeContent = escapeHtml(msg.content);

            return `
                <tr>
                    <td class="msg-num">${i + 1}</td>
                    <td class="msg-time">${timeLabel}</td>
                    <td class="${senderClass}">${senderLabel}</td>
                    <td class="msg-content">${safeContent}</td>
                </tr>
            `;
        }).join('');

        // Build full printable HTML
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>KSP Chat Report — ${dateStr}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 12px;
            color: #1a1a2e;
            line-height: 1.5;
            padding: 30px;
        }

        .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #1a1a2e;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }

        .report-brand {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .report-logo {
            width: 50px;
            height: 50px;
        }

        .report-title {
            font-family: 'Outfit', sans-serif;
            font-size: 20px;
            font-weight: 700;
            color: #1a1a2e;
        }

        .report-subtitle {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .report-meta {
            text-align: right;
            font-size: 11px;
            color: #555;
        }

        .report-meta strong {
            color: #1a1a2e;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
            padding: 14px;
            background: #f8f8fc;
            border-radius: 8px;
            border: 1px solid #e0e0e8;
        }

        .info-item label {
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #888;
            margin-bottom: 2px;
        }

        .info-item span {
            font-weight: 600;
            font-size: 12px;
            color: #1a1a2e;
        }

        .transcript-label {
            font-family: 'Outfit', sans-serif;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #1a1a2e;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
        }

        thead {
            background: #1a1a2e;
            color: #fff;
        }

        th {
            padding: 10px 12px;
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            font-weight: 600;
        }

        td {
            padding: 10px 12px;
            border-bottom: 1px solid #eee;
            vertical-align: top;
        }

        .msg-num {
            width: 30px;
            color: #aaa;
            text-align: center;
        }

        .msg-time {
            width: 70px;
            color: #888;
            font-size: 11px;
        }

        .sender-user {
            width: 140px;
            color: #FF0D3A;
            font-weight: 600;
        }

        .sender-ai {
            width: 140px;
            color: #1a1a2e;
            font-weight: 600;
        }

        .msg-content {
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
        }

        tbody tr:hover { background: #f5f5ff; }
        tbody tr:nth-child(even) { background: #fafafe; }
        tbody tr:nth-child(even):hover { background: #f0f0ff; }

        .report-footer {
            border-top: 2px solid #1a1a2e;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #999;
        }

        .watermark {
            text-align: center;
            font-size: 9px;
            color: #ccc;
            margin-top: 16px;
            letter-spacing: 0.5px;
        }

        @media print {
            body { padding: 15px; }
            thead { background: #333 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .sender-user { color: #333; }
            tbody tr:nth-child(even) { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="report-header">
        <div class="report-brand">
            <svg class="report-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 5 L90 20 L90 50 Q90 80 50 95 Q10 80 10 50 L10 20 Z"
                      fill="#f0f0f5" stroke="#1a1a2e" stroke-width="2"/>
                <polygon points="50,28 54,40 67,40 57,48 60,60 50,52 40,60 43,48 33,40 46,40"
                         fill="#1a1a2e" opacity="0.9"/>
                <text x="50" y="76" text-anchor="middle" fill="#1a1a2e"
                      font-family="Outfit,sans-serif" font-size="11" font-weight="700" letter-spacing="3">KSP</text>
            </svg>
            <div>
                <div class="report-title">Crime Intelligence Chat Report</div>
                <div class="report-subtitle">Karnataka State Police • Confidential</div>
            </div>
        </div>
        <div class="report-meta">
            <strong>${dateStr}</strong><br>
            ${timeStr}
        </div>
    </div>

    <div class="info-grid">
        <div class="info-item">
            <label>Officer</label>
            <span>${escapeHtml(officerName)}</span>
        </div>
        <div class="info-item">
            <label>Role</label>
            <span>${escapeHtml(officerRole)}</span>
        </div>
        <div class="info-item">
            <label>Session ID</label>
            <span>${escapeHtml(sessionId || 'N/A')}</span>
        </div>
        <div class="info-item">
            <label>Messages</label>
            <span>${messages.length}</span>
        </div>
    </div>

    <div class="transcript-label">Chat Transcript</div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Time</th>
                <th>Sender</th>
                <th>Message</th>
            </tr>
        </thead>
        <tbody>
            ${messageRows}
        </tbody>
    </table>

    <div class="report-footer">
        <span>Generated by KSP Crime Intelligence Platform</span>
        <span>Report ID: RPT-${Date.now()}</span>
    </div>

    <div class="watermark">
        This document is auto-generated and classified. Handle as per KSP data classification policy.
    </div>

    <script>
        window.onload = function() { window.print(); };
    </script>
</body>
</html>`;

        // Open in new window
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        } else {
            alert('Pop-up blocked. Please allow pop-ups for this site to export the report.');
        }
    }

    /**
     * Escape HTML special characters
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text || ''));
        return div.innerHTML;
    }

    // ── Public API ───────────────────────────────
    return { exportChat };
})();

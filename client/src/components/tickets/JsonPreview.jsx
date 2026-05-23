import { useState } from 'react';
import { Copy, Download, ChevronDown, ChevronUp, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { copyToClipboard, downloadJSON } from '../../utils/helpers';

function toJiraFormat(ticket) {
  return {
    summary: ticket.title,
    description: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: ticket.description || '' }],
        },
        ...(ticket.stepsToReproduce?.length
          ? [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Steps to Reproduce:', attrs: { bold: true } }],
              },
              ...ticket.stepsToReproduce.map((step, i) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: `${i + 1}. ${step}` }],
              })),
            ]
          : []),
      ],
    },
    issuetype: { name: 'Bug' },
    priority: { name: ticket.priority },
    labels: ticket.labels || [],
    environment: ticket.environment,
    customfield_10001: ticket.severity,
    customfield_10002: ticket.acceptanceCriteria?.join('\n'),
  };
}

function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-blue-500 dark:text-blue-400';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-violet-600 dark:text-violet-400 font-medium';
        } else {
          cls = 'text-green-600 dark:text-green-400';
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-orange-500 dark:text-orange-400';
      } else if (/null/.test(match)) {
        cls = 'text-red-400';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

export default function JsonPreview({ ticket }) {
  const [format, setFormat] = useState('raw'); // 'raw' | 'jira'
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const data = format === 'jira' ? toJiraFormat(ticket) : ticket;
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await copyToClipboard(jsonString);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const filename = `${ticket.ticketRef || 'ticket'}-${format}.json`;
    downloadJSON(data, filename);
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <div className="border border-gray-200 dark:border-secondary-600 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-secondary-700 border-b border-gray-200 dark:border-secondary-600">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            JSON Preview
          </span>
          {/* Format toggle */}
          <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-secondary-600">
            {['raw', 'jira'].map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  format === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-secondary-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-secondary-700'
                }`}
              >
                {f === 'raw' ? 'Raw Format' : 'Jira Format'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-secondary-600 rounded-lg transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-secondary-600 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* Code block */}
      {!collapsed && (
        <div className="bg-gray-900 dark:bg-secondary-950 overflow-auto max-h-96 scrollbar-thin">
          <pre className="p-4 text-xs font-mono leading-relaxed">
            <code
              dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonString) }}
            />
          </pre>
        </div>
      )}
    </div>
  );
}

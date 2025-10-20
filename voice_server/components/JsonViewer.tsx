
import React, { useState } from 'react';

interface JsonViewerProps {
  data: object;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const syntaxHighlight = (json: string) => {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'text-green-400'; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-pink-400'; // key
        } else {
          cls = 'text-yellow-400'; // string
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-blue-400'; // boolean
      } else if (/null/.test(match)) {
        cls = 'text-gray-500'; // null
      }
      return `<span class="${cls}">${match}</span>`;
    });
  };

  return (
    <div className="relative w-full max-w-2xl bg-gray-800 rounded-lg shadow-lg">
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-300">Hóa đơn đã tạo (JSON)</span>
        <button
          onClick={copyToClipboard}
          className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
        >
          {copied ? 'Đã sao chép!' : 'Sao chép'}
        </button>
      </div>
      <pre className="p-4 text-sm whitespace-pre-wrap break-all overflow-x-auto">
        <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonString) }} />
      </pre>
    </div>
  );
};

export default JsonViewer;

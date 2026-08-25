import React, { useState } from 'react';
import { HelpCircle, Send } from 'lucide-react';

interface AskViewProps {
  onAsk: (question: string) => void;
  isLoading: boolean;
  selectedText?: string;
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
}

export const AskView: React.FC<AskViewProps> = ({
  onAsk,
  isLoading,
  selectedText,
  chatHistory,
}) => {
  const [question, setQuestion] = useState('');

  const quickQuestions = [
    '为什么我觉得这一段写得很假？',
    '哪一句最应该删？',
    '这里的问题是不是叙述距离失控了？',
    '删掉解释后如何让环境细节承担情绪？',
    '这一段对白是否太像作者借角色讲话？',
  ];

  const handleSend = () => {
    if (!question.trim() || isLoading) return;
    onAsk(question);
    setQuestion('');
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Active Context Banner */}
      {selectedText && (
        <div className="p-2.5 bg-paper-sunken rounded border border-line text-xs font-serif">
          <span className="font-bold text-ink block mb-1">讨论目标选区：</span>
          <p className="text-ink-muted line-clamp-2">“{selectedText}”</p>
        </div>
      )}

      {/* Quick Prompts */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-ink-muted block">
          快捷推敲发问:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {quickQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => onAsk(q)}
              disabled={isLoading}
              className="text-[11px] px-2 py-1 bg-paper-sunken hover:bg-line text-ink-muted rounded transition-colors text-left font-serif"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="space-y-3 font-serif text-xs leading-relaxed max-h-[45vh] overflow-y-auto pr-1">
        {chatHistory.length === 0 ? (
          <div className="py-8 text-center text-ink-muted">
            <HelpCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p>向你的文学编辑提出任何关乎语感、叙述距离、修辞取舍的问题。</p>
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div
              key={i}
              className={`p-3 rounded ${
                msg.role === 'user'
                  ? 'bg-paper-sunken text-ink ml-4'
                  : 'bg-paper border border-line text-ink-muted mr-2'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 opacity-60">
                {msg.role === 'user' ? '作者' : '文学编辑'}
              </span>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="pt-2 mt-auto border-t border-line">
        <div className="relative flex items-center">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入文学讨论问题……"
            className="w-full pl-3 pr-9 py-2 text-xs font-serif bg-paper border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-cinnabar text-ink"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !question.trim()}
            className="absolute right-1.5 p-1 text-cinnabar hover:text-cinnabar-strong disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

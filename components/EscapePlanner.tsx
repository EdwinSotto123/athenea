import React, { useState, useEffect, useRef } from 'react';
import { sendPlannerMessage } from '../services/geminiService';
import { EscapePlan, ChatMessage } from '../types';
import { Cpu, Cloud, CloudOff, Loader2, Check, Circle } from 'lucide-react';
import {
  auth,
  saveChatMessage,
  loadChatHistory,
  saveEscapePlan,
  loadEscapePlan,
  saveSafeContact
} from '../lib/firebase';

const INITIAL_MESSAGE: ChatMessage = {
  role: 'model',
  text: "Hello 💜 I'm Athena, your silent guardian. First, I want you to know you're incredibly brave for reaching out.\n\nThis is a REAL protection tool, not a scam. I can help you:\n• Build a secret Freedom Vault (savings invisible to others)\n• Document evidence with legal timestamps\n• Create an emergency escape plan\n\nHow are you feeling right now? Are you in a safe place to talk?"
};

export const EscapePlanner: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [plan, setPlan] = useState<EscapePlan | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [completedPhases, setCompletedPhases] = useState<{ [key: number]: boolean }>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history from Firestore on mount
  useEffect(() => {
    const loadHistory = async () => {
      const user = auth.currentUser;

      if (user) {
        setIsLoadingHistory(true);
        try {
          // Load chat history
          const history = await loadChatHistory(user.uid, 100);

          if (history.length > 0) {
            // Map firebase messages to local format
            const loadedMessages: ChatMessage[] = history.map(msg => ({
              role: msg.role,
              text: msg.text
            }));
            setMessages(loadedMessages);
            setIsSynced(true);
          } else {
            // No history - start with initial message and save it
            setMessages([INITIAL_MESSAGE]);
            await saveChatMessage(user.uid, INITIAL_MESSAGE);
            setIsSynced(true);
          }

          // Load saved plan if exists
          const savedPlan = await loadEscapePlan(user.uid);
          if (savedPlan && savedPlan.isReady) {
            setPlan(savedPlan);
          }

        } catch (error) {
          console.error('[EscapePlanner] Failed to load history:', error);
          setIsSynced(false);
        } finally {
          setIsLoadingHistory(false);
        }
      } else {
        // No user logged in - use local state only
        setIsLoadingHistory(false);
        setIsSynced(false);
      }
    };

    loadHistory();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Save user message to Firestore
    const user = auth.currentUser;
    if (user) {
      try {
        await saveChatMessage(user.uid, userMsg);
      } catch (error) {
        console.error('[EscapePlanner] Failed to save user message:', error);
      }
    }

    try {
      // Call ADK-TS style agent (via geminiService with context)
      const response = await sendPlannerMessage([...messages, userMsg], userMsg.text);

      setIsTyping(false);

      if (response.plan) {
        // Generate unique caseId for this plan
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        const caseId = `ATHENA-${timestamp}-${random}`;
        const poolContractAddress = '0x4Bca7ebC3Cba0ea5Ada962E319BfB8353De81605';

        // Enhance plan with caseId and pool info
        const enhancedPlan = {
          ...response.plan,
          caseId,
          poolContractAddress
        };

        // Save plan to Firestore
        if (user) {
          try {
            await saveEscapePlan(user.uid, enhancedPlan);

            // Save emergency contact if provided
            if (response.plan.emergencyContact && response.plan.emergencyContact.name) {
              const withdrawalMethod = (response.plan.emergencyContact as any).withdrawalMethod || 'PHONE';
              const contactData: any = {
                name: response.plan.emergencyContact.name,
                relationship: response.plan.emergencyContact.relationship || 'Emergency Contact',
                withdrawalMethod: withdrawalMethod,
                contactInfo: response.plan.emergencyContact.contactInfo || ''
              };

              // Only add specific fields if they have values (Firestore doesn't accept undefined)
              if (withdrawalMethod === 'WALLET') {
                contactData.walletAddress = response.plan.emergencyContact.contactInfo || '';
              } else if (withdrawalMethod === 'PHONE') {
                contactData.phoneNumber = response.plan.emergencyContact.contactInfo || '';
              } else if (withdrawalMethod === 'CASH_CODE') {
                contactData.fullName = response.plan.emergencyContact.name;
              }

              await saveSafeContact(user.uid, contactData);
            }
          } catch (error) {
            console.error('[EscapePlanner] Failed to save plan:', error);
          }
        }

        // Trigger "Analysis Mode" effect before showing result
        setIsAnalyzing(true);
        setTimeout(() => {
          setIsAnalyzing(false);
          setPlan(enhancedPlan);
        }, 2500); // 2.5s delay for "Wow" factor
      } else {
        const modelMsg: ChatMessage = { role: 'model', text: response.text };
        setMessages(prev => [...prev, modelMsg]);

        // Save model response to Firestore
        if (user) {
          try {
            await saveChatMessage(user.uid, modelMsg);
          } catch (error) {
            console.error('[EscapePlanner] Failed to save model message:', error);
          }
        }
      }
    } catch (error) {
      setIsTyping(false);
      const errorMsg: ChatMessage = {
        role: 'model',
        text: 'Connection interrupted. Please try again.'
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  // 1. LOADING HISTORY SCREEN
  if (isLoadingHistory) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-neutral-950 p-6">
        <Loader2 className="w-10 h-10 text-athena-500 animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Loading chat history...</p>
      </div>
    );
  }

  // 2. ANALYSIS LOADING SCREEN (The "Wow" Moment)
  if (isAnalyzing) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-black p-6 space-y-6 animate-in fade-in duration-700">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-athena-900 border-t-athena-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🧠</span>
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-mono text-athena-500 font-bold tracking-widest animate-pulse">
            ATHENA AI RUNNING...
          </h2>
          <div className="text-xs text-gray-500 font-mono space-y-1">
            <p>Scanning Safe Routes...</p>
            <p>Calculating Inflation-Adjusted Costs...</p>
            <p>Encrypting Destination Data...</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. RESULT CARD (The "Checklist" View)
  if (plan) {
    return (
      <div className="p-6 h-full overflow-y-auto bg-neutral-950 animate-in slide-in-from-bottom-10 duration-700">
        {/* Header Card */}
        <div className="flex justify-between items-end mb-6 border-b border-neutral-800 pb-4">
          <div>
            <p className="text-[10px] text-athena-500 font-bold uppercase tracking-widest mb-1">Generated Strategy</p>
            <h2 className="text-2xl font-bold text-white leading-none">Operation<br />Freedom</h2>
          </div>
          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded text-xs font-bold border ${plan.riskLevel >= 8 ? 'bg-red-900/30 border-red-500 text-red-500' : 'bg-yellow-900/30 border-yellow-500 text-yellow-500'}`}>
              RISK LEVEL {plan.riskLevel}
            </span>
          </div>
        </div>

        {/* Financial Goal Dial */}
        <div className="bg-neutral-900/50 rounded-2xl p-6 border border-neutral-800 mb-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.15-1.46-3.27-3.4h1.96c.1 1.05 1.18 1.91 2.53 1.91 1.29 0 2.13-.81 2.13-1.88 0-1.09-.86-1.63-2.6-2.09-2.08-.56-4.18-1.42-4.18-3.92 0-2.06 1.47-3.53 3.43-3.9V3h2.67v1.93c1.38.35 2.58 1.34 2.74 2.95h-2c-.09-.92-1.01-1.45-2.26-1.45-1.2 0-2 .76-2 1.68 0 .96.93 1.48 2.56 1.93 2.19.63 4.22 1.6 4.22 4.1 0 2.05-1.4 3.55-3.36 3.95z" /></svg>
          </div>

          <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Freedom Fund Goal</h3>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-5xl font-mono font-bold text-white tracking-tighter">${plan.freedomGoal.targetAmount}</span>
            <span className="text-gray-500 text-sm mb-2">{plan.freedomGoal.currency}</span>
          </div>

          <div className="w-full bg-black h-2 rounded-full overflow-hidden">
            <div className="bg-athena-500 h-full w-[5%] shadow-[0_0_10px_rgba(236,72,153,0.5)]"></div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 flex justify-between">
            <span>Current: ${plan.freedomGoal.currentAmount}</span>
            <span>Target for {plan.destination}</span>
          </p>

          {/* Budget Breakdown */}
          {plan.freedomGoal.breakdown && (
            <div className="mt-4 pt-4 border-t border-neutral-800">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Budget Breakdown</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>🚗 Transport</span>
                  <span className="text-white">${plan.freedomGoal.breakdown.transport}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>📦 Supplies</span>
                  <span className="text-white">${plan.freedomGoal.breakdown.supplies}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>🏠 Shelter</span>
                  <span className="text-white">${plan.freedomGoal.breakdown.shelter}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>⚖️ Legal</span>
                  <span className="text-white">${plan.freedomGoal.breakdown.legal}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Emergency Contact Card */}
        {plan.emergencyContact && plan.emergencyContact.name && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-500 text-lg">🆘</span>
              <h4 className="text-green-400 text-sm font-bold">Emergency Contact Set</h4>
            </div>
            <div className="text-xs space-y-1">
              <p className="text-gray-300">
                <span className="text-gray-500">Name:</span> {plan.emergencyContact.name}
              </p>
              <p className="text-gray-300">
                <span className="text-gray-500">Contact:</span> {plan.emergencyContact.contactInfo}
              </p>
              <p className="text-gray-300">
                <span className="text-gray-500">Relation:</span> {plan.emergencyContact.relationship}
              </p>
            </div>

            {/* Withdrawal Method Badge */}
            <div className="mt-3 pt-3 border-t border-green-500/20">
              <p className="text-[10px] text-gray-500 mb-1">WITHDRAWAL METHOD</p>
              <div className="flex items-center gap-2">
                {(plan.emergencyContact as any).withdrawalMethod === 'PHONE' ? (
                  <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">📱 Mobile Money</span>
                ) : (plan.emergencyContact as any).withdrawalMethod === 'CASH_CODE' ? (
                  <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">💵 Cash Pickup (Coming Soon)</span>
                ) : (
                  <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs">🔐 Crypto Wallet</span>
                )}
              </div>
            </div>

            <p className="text-[10px] text-green-600 mt-2">
              SOS will transfer funds to this person
            </p>
          </div>
        )}

        {/* The Visual Checklist - INTERACTIVE */}
        <div className="space-y-4">
          <h3 className="text-gray-300 font-bold text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-athena-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            Execution Checklist
            <span className="text-[10px] text-gray-500 font-normal ml-auto">
              {Object.values(completedPhases).filter(Boolean).length}/3 complete
            </span>
          </h3>

          {/* Checklist Item 1 - CLICKABLE */}
          <button
            onClick={() => setCompletedPhases(prev => ({ ...prev, 1: !prev[1] }))}
            className={`group relative w-full text-left bg-neutral-900 border rounded-xl p-4 transition active:scale-[0.98] ${completedPhases[1] ? 'border-blue-500/50 bg-blue-500/5' : 'border-neutral-800 hover:border-neutral-700'
              }`}
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition ${completedPhases[1] ? 'bg-blue-500' : 'bg-blue-500/30'
              }`}></div>
            <div className="flex gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center mt-0.5 transition ${completedPhases[1]
                ? 'bg-blue-500 text-white'
                : 'border-2 border-neutral-600 group-hover:border-blue-500'
                }`}>
                {completedPhases[1] ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Circle className="w-3 h-3 text-transparent group-hover:text-blue-500" />
                )}
              </div>
              <div>
                <h4 className={`text-sm font-bold transition ${completedPhases[1] ? 'text-blue-400 line-through' : 'text-white'}`}>
                  Phase 1: Immediate Security
                </h4>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">{plan.strategy.step1}</p>
              </div>
            </div>
          </button>

          {/* Checklist Item 2 - CLICKABLE */}
          <button
            onClick={() => setCompletedPhases(prev => ({ ...prev, 2: !prev[2] }))}
            className={`group relative w-full text-left bg-neutral-900 border rounded-xl p-4 transition active:scale-[0.98] ${completedPhases[2] ? 'border-purple-500/50 bg-purple-500/5' : 'border-neutral-800 hover:border-neutral-700'
              }`}
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition ${completedPhases[2] ? 'bg-purple-500' : 'bg-purple-500/30'
              }`}></div>
            <div className="flex gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center mt-0.5 transition ${completedPhases[2]
                ? 'bg-purple-500 text-white'
                : 'border-2 border-neutral-600 group-hover:border-purple-500'
                }`}>
                {completedPhases[2] ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Circle className="w-3 h-3 text-transparent group-hover:text-purple-500" />
                )}
              </div>
              <div>
                <h4 className={`text-sm font-bold transition ${completedPhases[2] ? 'text-purple-400 line-through' : 'text-white'}`}>
                  Phase 2: Logistics & Funding
                </h4>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">{plan.strategy.step2}</p>
              </div>
            </div>
          </button>

          {/* Checklist Item 3 - CLICKABLE */}
          <button
            onClick={() => setCompletedPhases(prev => ({ ...prev, 3: !prev[3] }))}
            className={`group relative w-full text-left bg-neutral-900 border rounded-xl p-4 transition active:scale-[0.98] ${completedPhases[3] ? 'border-green-500/50 bg-green-500/5' : 'border-neutral-800 hover:border-neutral-700'
              }`}
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition ${completedPhases[3] ? 'bg-green-500' : 'bg-green-500/30'
              }`}></div>
            <div className="flex gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center mt-0.5 transition ${completedPhases[3]
                ? 'bg-green-500 text-white'
                : 'border-2 border-neutral-600 group-hover:border-green-500'
                }`}>
                {completedPhases[3] ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Circle className="w-3 h-3 text-transparent group-hover:text-green-500" />
                )}
              </div>
              <div>
                <h4 className={`text-sm font-bold transition ${completedPhases[3] ? 'text-green-400 line-through' : 'text-white'}`}>
                  Phase 3: Extraction
                </h4>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">{plan.strategy.step3}</p>
              </div>
            </div>
          </button>
        </div>

        {/* Next Steps Guide */}
        {plan.nextSteps && plan.nextSteps.length > 0 && (
          <div className="mt-6 bg-athena-900/20 border border-athena-500/30 rounded-xl p-4">
            <h4 className="text-athena-400 text-sm font-bold mb-3 flex items-center gap-2">
              <span>📋</span> What to Do Now
            </h4>
            <ul className="space-y-2">
              {plan.nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="text-athena-500 font-bold">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 💰 DONATION CARD - Share to receive help */}
        <div className="mt-6 bg-gradient-to-br from-purple-900/30 to-athena-900/30 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🌍</span>
            <h4 className="text-purple-400 text-sm font-bold">Community Angels Pool</h4>
          </div>

          <p className="text-gray-400 text-xs mb-4">
            Share your case to receive anonymous donations from supporters worldwide.
          </p>

          {/* Contract Address */}
          <div className="bg-black/40 rounded-lg p-3 mb-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Pool Contract Address</p>
            <div className="flex items-center justify-between">
              <code className="text-xs text-purple-300 font-mono break-all">
                {plan.poolContractAddress || '0x4Bca7ebC3Cba0ea5Ada962E319BfB8353De81605'}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(plan.poolContractAddress || '0x4Bca7ebC3Cba0ea5Ada962E319BfB8353De81605');
                  alert('Address copied!');
                }}
                className="ml-2 px-2 py-1 bg-purple-500/20 text-purple-400 text-[10px] rounded hover:bg-purple-500/30 transition"
              >
                COPY
              </button>
            </div>
          </div>

          {/* CaseID for donations */}
          {plan.caseId && (
            <div className="bg-black/40 rounded-lg p-3 mb-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Your Case ID (for donations)</p>
              <div className="flex items-center justify-between">
                <code className="text-xs text-green-400 font-mono">
                  {plan.caseId}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(plan.caseId || '');
                    alert('Case ID copied!');
                  }}
                  className="ml-2 px-2 py-1 bg-green-500/20 text-green-400 text-[10px] rounded hover:bg-green-500/30 transition"
                >
                  COPY
                </button>
              </div>
            </div>
          )}

          {/* Network Info */}
          <div className="flex items-center gap-4 text-[10px] text-gray-500 mb-4">
            <span>Network: <span className="text-purple-400">Fraxtal Testnet</span></span>
            <span>Chain ID: <span className="text-purple-400">2523</span></span>
          </div>

          {/* Share Button */}
          <button
            onClick={() => {
              const shareText = `🆘 Help someone escape domestic violence!\n\n` +
                `Contract: ${plan.poolContractAddress || '0x4Bca7ebC3Cba0ea5Ada962E319BfB8353De81605'}\n` +
                `Case ID: ${plan.caseId || 'Not assigned'}\n` +
                `Network: Fraxtal Testnet (Chain ID: 2523)\n` +
                `Goal: $${plan.freedomGoal.targetAmount}\n\n` +
                `To donate: Call donate("${plan.caseId}") with ETH\n\n` +
                `Every donation helps. 💜 #Athena #SafeHaven`;

              if (navigator.share) {
                navigator.share({ title: 'Help someone escape', text: shareText });
              } else {
                navigator.clipboard.writeText(shareText);
                alert('Share text copied to clipboard!');
              }
            }}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
          >
            <span>📤</span> Share to Get Help
          </button>

          <p className="text-[10px] text-gray-600 text-center mt-2">
            100% of donations go directly to you. No fees.
          </p>
        </div>

        {/* Quick Commands Reminder */}
        <div className="mt-4 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Secret Commands</p>
          <div className="flex gap-4 text-xs">
            <div className="text-gray-400">
              <span className="text-white font-mono">9÷11=</span> Check Balance
            </div>
            <div className="text-gray-400">
              <span className="text-white font-mono">7x7=</span> Pool Status
            </div>
            <div className="text-gray-400">
              <span className="text-white font-mono">0÷0=</span> <span className="text-red-400">SOS</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setPlan(null)}
          className="w-full mt-6 py-3 text-xs text-gray-500 hover:text-white transition uppercase tracking-widest border border-transparent hover:border-gray-800 rounded-lg"
        >
          Modify Parameters
        </button>
      </div>
    );
  }

  // 4. CHAT INTERFACE
  return (
    <div className="flex flex-col h-full bg-neutral-950">
      <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 bg-athena-500 rounded-full animate-pulse"></span>
              Athena Planner
            </h2>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Secure Agent • Encrypted</p>
          </div>

          {/* Sync Status + ADK Badge */}
          <div className="flex items-center gap-2">
            {/* Firestore Sync Status */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono ${isSynced ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
              {isSynced ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
              {isSynced ? 'SYNCED' : 'LOCAL'}
            </div>

            {/* ADK-TS Status Badge */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-400">
              <Cpu className="w-3 h-3" />
              ADK-TS
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
              ? 'bg-athena-600 text-white rounded-br-none'
              : 'bg-neutral-800 text-gray-200 rounded-bl-none border border-neutral-700'
              }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="bg-neutral-800 rounded-2xl p-4 rounded-bl-none flex gap-1 items-center h-12 border border-neutral-700">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-neutral-900 border-t border-neutral-800">
        <div className="flex gap-2">
          <input
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type here..."
            className="flex-1 bg-black border border-neutral-700 rounded-xl px-4 py-3 text-white focus:border-athena-500 outline-none transition placeholder-gray-600"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping}
            className="bg-athena-600 hover:bg-athena-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition shadow-lg shadow-athena-900/50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EscapePlanner;
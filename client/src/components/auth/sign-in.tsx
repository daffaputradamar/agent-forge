import React from 'react';
import { SignInButton } from '@clerk/clerk-react';

export default function SignInPanel() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-3xl w-full mx-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shadow-xl p-8 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="space-y-4 px-2">
            <h1 className="text-3xl font-extrabold">Welcome to Agent Forge</h1>
            <p className="text-sm text-muted-foreground">Create and deploy knowledgeable agents and chat with them instantly. Sign in to continue — your agents and documents are private to your account.</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <SignInButton mode="modal" appearance={{
                layout:{
                    unsafe_disableDevelopmentModeWarnings: true
                }
              }}>
                  <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-95">Continue with Google</button>
                </SignInButton>
            </div>

            <ul className="text-xs text-muted-foreground mt-4 space-y-2">
              <li><strong>Privacy:</strong> Your data is private to your account.</li>
              <li><strong>Pro tip:</strong> Use Google sign-in for the fastest setup.</li>
            </ul>
          </div>

          <div className="hidden lg:flex items-center justify-center">
            <div className="w-full h-56 rounded-lg bg-gradient-to-tr from-primary/40 to-indigo-400 flex items-center justify-center text-white">
              <svg viewBox="0 0 720 480" className="w-52 h-36" role="img" aria-hidden="false" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.95" />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" x2="1">
                    <stop offset="0%" stopColor="#C7B3FF" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0.85" />
                  </linearGradient>
                  <filter id="f1" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.15 0 0 0 0 0.55 0 0 0 0 0.95 0 0 0 0.6 0" />
                  </filter>
                </defs>

                {/* background soft glow */}
                <g filter="url(#f1)">
                  <ellipse cx="360" cy="200" rx="260" ry="110" fill="url(#g2)" transform="rotate(-8 360 200)" />
                </g>

                {/* agent core */}
                <g transform="translate(200,120)">
                  <rect x="0" y="0" width="200" height="160" rx="28" fill="url(#g1)" opacity="0.98" />
                  <circle cx="60" cy="60" r="28" fill="rgba(255,255,255,0.95)" />
                  <rect x="100" y="50" width="70" height="18" rx="8" fill="rgba(255,255,255,0.9)" />
                  <rect x="24" y="100" width="152" height="14" rx="7" fill="rgba(255,255,255,0.65)" />
                </g>

                {/* floating cards */}
                <g transform="translate(420,60)">
                  <rect x="0" y="0" width="140" height="92" rx="14" fill="#FFFFFF" opacity="0.08" />
                  <rect x="8" y="10" width="60" height="12" rx="6" fill="rgba(255,255,255,0.9)" />
                  <rect x="8" y="34" width="110" height="10" rx="5" fill="rgba(255,255,255,0.6)" />
                </g>

                <g transform="translate(120,28) rotate(-6 360 200)">
                  <rect x="0" y="0" width="84" height="56" rx="12" fill="#FFFFFF" opacity="0.06" />
                </g>

                {/* small nodes */}
                <circle cx="540" cy="270" r="6" fill="#fff" opacity="0.9" />
                <circle cx="480" cy="340" r="4" fill="#fff" opacity="0.6" />
                <circle cx="260" cy="340" r="5" fill="#fff" opacity="0.7" />

                {/* subtle frame accent */}
                <rect x="16" y="16" width="688" height="448" rx="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../components/UIComponents';
import { LogIn } from 'lucide-react';
import { MANDALA_URL } from '../constants';

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]">
        <img 
          src={MANDALA_URL} 
          alt="" 
          className="absolute -top-64 -left-64 w-[800px] h-[800px] animate-[spin_120s_linear_infinite]" 
        />
        <img 
          src={MANDALA_URL} 
          alt="" 
          className="absolute -bottom-64 -right-64 w-[800px] h-[800px] animate-[spin_180s_linear_infinite_reverse]" 
        />
      </div>
      <div className="jali-pattern absolute inset-0 pointer-events-none opacity-20" />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-white/80 backdrop-blur-xl border border-primary/10 p-12 rounded-3xl shadow-2xl text-center space-y-8">
          <div>
            <h1 className="text-4xl font-display font-bold text-primary mb-2">ShadiOps</h1>
            <p className="text-[10px] font-bold text-outline uppercase tracking-[0.2em]">Command Center Access</p>
          </div>

          <div className="py-8">
            <div className="w-24 h-24 bg-primary-container rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
               <LogIn size={40} className="text-on-primary-container" />
            </div>
            <h2 className="text-xl font-bold text-primary">Welcome Back</h2>
            <p className="text-sm text-on-surface-variant mt-2">Please authenticate to manage the grand celebration.</p>
          </div>

          <Button 
            variant="primary" 
            className="w-full h-14 text-sm tracking-[0.2em]"
            onClick={login}
          >
            Authenticate with Google
          </Button>

          <p className="text-[10px] font-medium text-outline uppercase tracking-widest opacity-60 pt-4">
            Secured by enterprise-grade encryption
          </p>
        </div>
      </div>
    </div>
  );
}

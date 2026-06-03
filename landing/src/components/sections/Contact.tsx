'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import GlassCard from '@/components/ui/GlassCard';

const CONTACT_ITEMS = [
  { icon: '✉️', label: 'Email',    value: 'hexacore037@gmail.com'         },
  { icon: '⌥',  label: 'GitHub',   value: 'github.com/mahmoud416'         },
  { icon: 'in', label: 'LinkedIn', value: 'linkedin.com/in/orbit-platform' },
  { icon: '📍', label: 'Location', value: 'Egypt — Building for the world' },
] as const;

export default function Contact() {
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setSent(true); }, 1200);
  };

  return (
    <section id="contact" className="relative py-32 overflow-hidden" style={{ background: '#080812' }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 20% 50%, rgba(26,111,255,.04) 0%, transparent 70%)' }} />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-2 gap-16 items-start">

          {/* Left */}
          <div>
            <SectionHeader
              badge="Launch With Orbit"
              title="Ready to"
              highlight="Enter Orbit?"
              subtitle="Join the teams already operating at mission-critical performance. Get in touch and we'll onboard your workspace."
            />

            <div className="flex flex-col gap-5 mt-2">
              {CONTACT_ITEMS.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-11 h-11 rounded-[10px] border border-white/[0.09] flex items-center justify-center text-xl
                    bg-white/[0.02] flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white mb-0.5">{item.label}</p>
                    <p className="text-[13px] text-slate-400">{item.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <GlassCard topLine delay={0.2} className="p-8">
            <h3 className="font-display text-xl font-bold mb-6">Mission Contact</h3>

            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="text-5xl mb-4">🚀</div>
                <h4 className="font-display text-xl font-bold mb-2">Message Sent!</h4>
                <p className="text-slate-400 text-sm">We'll reach out and get you into orbit soon.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {[
                  { label: 'Full Name',      type: 'text',  placeholder: 'Your name'             },
                  { label: 'Email Address',  type: 'email', placeholder: 'you@organization.com'  },
                  { label: 'Organization',   type: 'text',  placeholder: 'University / Company'  },
                ].map(field => (
                  <div key={field.label}>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">{field.label}</label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      required
                      className="w-full px-4 py-3 rounded-[10px] text-sm text-white placeholder-slate-600
                        bg-white/[0.03] border border-white/[0.07] outline-none
                        focus:border-orbit-blue/50 focus:ring-2 focus:ring-orbit-blue/10
                        transition-all duration-200"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Message</label>
                  <textarea
                    placeholder="Tell us about your workspace needs..."
                    required
                    rows={4}
                    className="w-full px-4 py-3 rounded-[10px] text-sm text-white placeholder-slate-600
                      bg-white/[0.03] border border-white/[0.07] outline-none
                      focus:border-orbit-blue/50 focus:ring-2 focus:ring-orbit-blue/10
                      transition-all duration-200 resize-none"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-[10px] bg-orbit-blue text-white font-semibold text-sm
                    shadow-glow-blue hover:shadow-glow-blue-lg transition-all duration-200
                    disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Launching...</>
                  ) : (
                    <>Launch Orbit <span>→</span></>
                  )}
                </motion.button>
              </form>
            )}
          </GlassCard>
        </div>
      </div>
    </section>
  );
}

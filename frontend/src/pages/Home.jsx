import { Link, Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const features = [
  {
    icon: '🛰️',
    title: 'Automated Reconnaissance',
    description: 'Collects target intelligence quickly, mapping domains, hosts, and exposed services.',
  },
  {
    icon: '🛡️',
    title: 'Vulnerability Scanning',
    description: 'Runs focused scans to identify weaknesses across network and web attack surfaces.',
  },
  {
    icon: '🧠',
    title: 'AI Decision Engine',
    description: 'Prioritizes next actions using contextual signals and risk-aware decision logic.',
  },
  {
    icon: '🎯',
    title: 'Multi-Stage Attack Simulation',
    description: 'Executes controlled attack chains to validate exploitability and business impact.',
  },
  {
    icon: '🔧',
    title: 'Tool Integration (Nmap, Nikto, Metasploit)',
    description: 'Orchestrates proven tools in one coordinated workflow for consistent execution.',
  },
  {
    icon: '📄',
    title: 'Smart Report Generation',
    description: 'Creates clear technical and executive reports with findings, evidence, and fixes.',
  },
];

const workflowSteps = [
  'Reconnaissance',
  'Scanning',
  'Analysis',
  'Exploitation (Controlled)',
  'Reporting',
];

const benefits = [
  'Saves time',
  'Reduces manual effort',
  'Consistent results',
  'AI-powered decision making',
  'Scalable security testing',
];

const FeatureCard = ({ icon, title, description }) => (
  <article className="group rounded-2xl border border-[#1a1f3a] bg-[#0a0f22]/80 p-6 transition duration-300 hover:-translate-y-1 hover:border-[#4f46e5]/60 hover:bg-[#0c1228]">
    <div className="mb-3 text-2xl">{icon}</div>
    <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
    <p className="text-sm leading-relaxed text-slate-300">{description}</p>
  </article>
);

const StepItem = ({ index, title }) => (
  <div className="relative flex items-center gap-4">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#6366f1]/60 bg-[#6366f1]/10 text-sm font-semibold text-[#a5b4fc] transition duration-300 group-hover:scale-105">
      {index}
    </div>
    <div className="rounded-xl border border-[#1a1f3a] bg-[#0a0f22]/80 px-4 py-3 text-slate-100 transition duration-300 hover:border-[#4f46e5]/60">
      {title}
    </div>
  </div>
);

const Home = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#05070f] text-white">
      <div className="absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-[#4338ca]/25 blur-3xl" />
        <div className="absolute top-72 -left-20 h-72 w-72 rounded-full bg-[#312e81]/30 blur-3xl" />
        <div className="absolute bottom-20 right-0 h-80 w-80 rounded-full bg-[#1d4ed8]/15 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-12 md:px-10 lg:px-14">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1a1f3a] bg-[#060b1a]/85 px-5 py-4">
          <Link to="/" className="text-lg font-semibold tracking-wide text-white">
            PAIA
          </Link>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-3 text-sm">
            <Link to="/" className="text-slate-300 transition hover:text-[#a5b4fc]">
              Home
            </Link>
            <a href="#about" className="text-slate-300 transition hover:text-[#a5b4fc]">
              About
            </a>
            <a href="#contact" className="text-slate-300 transition hover:text-[#a5b4fc]">
              Contact
            </a>
            <Link
              to="/signup"
              className="rounded-lg bg-[#4f46e5] px-4 py-2 font-semibold text-white transition hover:bg-[#6366f1]"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-[#2b3157] px-4 py-2 font-semibold text-slate-100 transition hover:border-[#6366f1] hover:text-[#c7d2fe]"
            >
              Sign In
            </Link>
          </div>
        </header>

        <section className="grid items-center gap-10 pb-20 pt-6 lg:grid-cols-2">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-[#4f46e5]/40 bg-[#4f46e5]/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-[#a5b4fc]">
              Cybersecurity Automation Platform
            </p>
            <h1 className="mb-5 text-4xl font-bold leading-tight text-white md:text-5xl">
              PAIA - AI Penetration Testing Agent
            </h1>
            <h2 className="mb-4 text-xl font-medium text-[#a5b4fc] md:text-2xl">
              Automating Cybersecurity with Intelligence
            </h2>
            <p className="mb-8 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
              PAIA automates reconnaissance, vulnerability scanning, analysis, and reporting through
              an AI-driven workflow. Security teams gain faster assessments, clearer insights, and
              consistent testing outcomes from a single intelligent platform.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/signup"
                className="rounded-xl bg-[#4f46e5] px-6 py-3 text-sm font-semibold text-white transition duration-300 hover:scale-105 hover:bg-[#6366f1]"
              >
                Get Started
              </Link>
              <a
                href="#about"
                className="rounded-xl border border-[#2b3157] px-6 py-3 text-sm font-semibold text-slate-100 transition duration-300 hover:border-[#6366f1] hover:text-[#c7d2fe]"
              >
                Learn More
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#4f46e5]/45 via-[#4338ca]/40 to-[#1d4ed8]/30 blur opacity-75" />
            <div className="relative overflow-hidden rounded-2xl border border-[#202849] bg-[#060b1a] p-6">
              <div className="mb-4 flex items-center justify-between border-b border-[#1a1f3a] pb-4">
                <p className="text-sm font-semibold text-[#a5b4fc]">AI Security Operations View</p>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">
                  Live
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-[#1a1f3a] bg-[#0b1123]/90 p-3">
                  <span className="text-[#a5b4fc]">Recon:</span> Target assets mapped and fingerprinted.
                </div>
                <div className="rounded-lg border border-[#1a1f3a] bg-[#0b1123]/90 p-3">
                  <span className="text-[#a5b4fc]">Scan:</span> Vulnerability probes running with smart
                  prioritization.
                </div>
                <div className="rounded-lg border border-[#1a1f3a] bg-[#0b1123]/90 p-3">
                  <span className="text-[#a5b4fc]">AI Insight:</span> High-risk findings escalated for
                  analyst review.
                </div>
                <div className="rounded-lg border border-[#1a1f3a] bg-[#0b1123]/90 p-3">
                  <span className="text-[#a5b4fc]">Report:</span> Executive-ready output generated.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="pb-20">
          <div className="rounded-2xl border border-[#1a1f3a] bg-[#0a0f22]/80 p-8 md:p-10">
            <h2 className="mb-4 text-3xl font-semibold text-white">About PAIA</h2>
            <p className="max-w-4xl leading-relaxed text-slate-300">
              PAIA is an AI-driven penetration testing system that acts as an intelligent orchestrator
              across every assessment stage. It reduces manual effort by coordinating established
              security tools like Nmap, Nikto, and Metasploit, while continuously analyzing output to
              drive smarter next steps. The result is faster validation, stronger coverage, and
              dependable security testing workflows.
            </p>
          </div>
        </section>

        <section className="pb-20">
          <h2 className="mb-8 text-3xl font-semibold">Core Features</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </section>

        <section className="pb-20">
          <h2 className="mb-8 text-3xl font-semibold">Workflow</h2>
          <div className="group grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {workflowSteps.map((step, idx) => (
              <StepItem key={step} index={idx + 1} title={step} />
            ))}
          </div>
        </section>

        <section className="pb-20">
          <h2 className="mb-8 text-3xl font-semibold">Why PAIA</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div
                key={benefit}
                className="rounded-xl border border-[#1a1f3a] bg-[#0a0f22]/80 p-4 text-slate-200 transition duration-300 hover:border-[#4f46e5]/60 hover:text-[#c7d2fe]"
              >
                {benefit}
              </div>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <div className="rounded-2xl border border-[#4f46e5]/40 bg-gradient-to-r from-[#080d1d] via-[#0b1123] to-[#1e1b4b]/70 p-8 text-center md:p-10">
            <h2 className="mb-4 text-3xl font-semibold">Start Securing Your Systems Today</h2>
            <p className="mx-auto mb-6 max-w-2xl text-slate-300">
              Launch PAIA and empower your team with AI-assisted penetration testing and actionable
              cyber risk intelligence.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex rounded-xl bg-[#4f46e5] px-6 py-3 text-sm font-semibold text-white transition duration-300 hover:scale-105 hover:bg-[#6366f1]"
            >
              Launch Dashboard
            </Link>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-t border-[#1a1f3a] bg-[#040814]/95">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-slate-400 md:flex-row md:items-center md:px-10 lg:px-14">
          <div>
            <p className="font-semibold text-slate-200">PAIA - Penetration Testing AI Agent</p>
            <p className="mt-1">Automating Cybersecurity with Intelligence</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

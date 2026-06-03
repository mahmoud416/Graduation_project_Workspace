import Navbar          from '@/components/nav/Navbar';
import Hero            from '@/components/sections/Hero';
import MissionControl  from '@/components/sections/MissionControl';
import Workspace       from '@/components/sections/Workspace';
import Projects        from '@/components/sections/Projects';
import QualityControl  from '@/components/sections/QualityControl';
import Analytics       from '@/components/sections/Analytics';
import Team            from '@/components/sections/Team';
import Contact         from '@/components/sections/Contact';
import Footer          from '@/components/Footer';
import ScrollScene     from '@/components/scenes/ScrollScene';
import SceneProgress   from '@/components/ui/SceneProgress';

export default function Home() {
  return (
    <main className="relative" style={{ background: '#05050d' }}>
      <Navbar />
      <SceneProgress />

      {/* 01 — Deep Space */}
      <Hero />

      {/* 02 — Orbit Ecosystem */}
      <ScrollScene num="02" name="Orbit Ecosystem" accent="#1a6fff" bg="#05060f">
        <MissionControl />
      </ScrollScene>

      {/* 03 — Workspace Galaxy */}
      <ScrollScene num="03" name="Workspace Galaxy" accent="#8b5cf6" bg="#070510">
        <Workspace />
      </ScrollScene>

      {/* 04 — Projects Planet */}
      <ScrollScene num="04" name="Projects Planet" accent="#10b981" bg="#050a07">
        <Projects />
      </ScrollScene>

      {/* 05 — Quality AI Core */}
      <ScrollScene num="05" name="Quality AI Core" accent="#f59e0b" bg="#0a0700">
        <QualityControl />
      </ScrollScene>

      {/* 06 — Analytics Nebula */}
      <ScrollScene num="06" name="Analytics Nebula" accent="#06b6d4" bg="#00090d">
        <Analytics />
      </ScrollScene>

      {/* 07 — Mission Crew */}
      <ScrollScene num="07" name="Mission Crew" accent="#ec4899" bg="#08050f">
        <Team />
      </ScrollScene>

      {/* 08 — Contact */}
      <ScrollScene num="08" name="Contact" accent="#1a6fff" bg="#05060f">
        <Contact />
      </ScrollScene>

      <Footer />
    </main>
  );
}

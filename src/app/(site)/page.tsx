import { ContentPreview } from "@/components/sections/content-preview";
import { CtaFinal } from "@/components/sections/cta-final";
import { DigitalAccountingPreview } from "@/components/sections/digital-accounting-preview";
import { Faq } from "@/components/sections/faq";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { HumanPlusTech } from "@/components/sections/human-plus-tech";
import { NeedsPicker } from "@/components/sections/needs-picker";
import { PlansTeaser } from "@/components/sections/plans-teaser";
import { ServicesPreview } from "@/components/sections/services-preview";
import { TaxReform } from "@/components/sections/tax-reform";
import { Testimonials } from "@/components/sections/testimonials";
import { TrustBar } from "@/components/sections/trust-bar";
import { WjbArmelx } from "@/components/sections/wjb-armelx";
import { RevealOnScroll } from "@/components/shared/reveal-on-scroll";

export default function Home() {
  return (
    <>
      <Hero />
      <RevealOnScroll>
        <TrustBar />
      </RevealOnScroll>
      <RevealOnScroll>
        <NeedsPicker />
      </RevealOnScroll>
      <RevealOnScroll>
        <ServicesPreview />
      </RevealOnScroll>
      <RevealOnScroll>
        <DigitalAccountingPreview />
      </RevealOnScroll>
      <RevealOnScroll>
        <HumanPlusTech />
      </RevealOnScroll>
      <RevealOnScroll>
        <HowItWorks />
      </RevealOnScroll>
      <RevealOnScroll>
        <PlansTeaser />
      </RevealOnScroll>
      <RevealOnScroll>
        <TaxReform />
      </RevealOnScroll>
      <RevealOnScroll>
        <WjbArmelx />
      </RevealOnScroll>
      <RevealOnScroll>
        <Testimonials />
      </RevealOnScroll>
      <RevealOnScroll>
        <ContentPreview />
      </RevealOnScroll>
      <RevealOnScroll>
        <Faq />
      </RevealOnScroll>
      <RevealOnScroll>
        <CtaFinal />
      </RevealOnScroll>
    </>
  );
}

import type { ProcessStep } from './ProcessSection';

export default function getDefaultProcessSteps(kind: 'home' | 'service' | 'serviceArea' | 'about'): ProcessStep[] {
  if (kind === 'home') {
    return [
      { heading: 'Reach Out', lede: 'Tell us what you need and share the key details of your project.' },
      { heading: 'Plan & Quote', lede: 'We review the scope, confirm options, and outline the next steps.' },
      { heading: 'Complete the Work', lede: 'Our team handles the job with clear communication throughout.' },
      { heading: 'Final Walkthrough', lede: 'We review the results and make sure everything is wrapped up right.' },
    ];
  }

  if (kind === 'serviceArea') {
    return [
      { heading: 'Contact Our Team', lede: 'Request service and let us know your location and project goals.' },
      { heading: 'Confirm Coverage', lede: 'We confirm availability in your area and recommend the right service path.' },
      { heading: 'Schedule Service', lede: 'We lock in a time window that works and prepare for the visit.' },
      { heading: 'Deliver & Follow Up', lede: 'We complete the work and review the outcome with you.' },
    ];
  }

  if (kind === 'about') {
    return [
      { heading: 'Listen First', lede: 'We start by understanding your goals, timeline, and priorities.' },
      { heading: 'Set Expectations', lede: 'You get clear communication on scope, scheduling, and what comes next.' },
      { heading: 'Do the Work Right', lede: 'We focus on workmanship, safety, and a clean professional process.' },
      { heading: 'Stand Behind It', lede: 'We follow through and stay available after the project is complete.' },
    ];
  }

  return [
    { heading: 'Request a Quote', lede: 'Share a few details so we can understand the scope of your service needs.' },
    { heading: 'Schedule the Visit', lede: 'We coordinate timing and confirm what to expect on the day of service.' },
    { heading: 'Complete the Service', lede: 'Our team performs the work and keeps you informed during the job.' },
    { heading: 'Review the Result', lede: 'We walk through the completed work and answer any final questions.' },
  ];
}

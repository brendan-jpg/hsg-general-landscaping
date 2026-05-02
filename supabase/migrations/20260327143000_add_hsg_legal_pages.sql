do $$
declare
  v_business_id uuid;
  v_now timestamptz := timezone('utc', now());
  v_privacy_content jsonb;
  v_terms_content jsonb;
begin
  select b.id
  into v_business_id
  from public.businesses b
  where b.id = '2d8b1b4c-0ec6-4002-8707-edb39964b151'
     or lower(coalesce(b.domain, '')) in ('hsgrowth.com', 'www.hsgrowth.com')
     or lower(coalesce(b.name, '')) = 'home service growth'
  order by case when b.id = '2d8b1b4c-0ec6-4002-8707-edb39964b151' then 0 else 1 end
  limit 1;

  if v_business_id is null then
    return;
  end if;

  v_privacy_content := jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Effective date: March 27, 2026.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Home Service Growth provides software, websites, lead forms, customer management tools, scheduling tools, estimates, invoices, and related services for home service businesses. This Privacy Policy explains what information we collect, how we use it, and the choices available to our customers, website visitors, and end users.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Information We Collect')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We may collect information you provide directly to us, information generated through use of the platform, and limited technical information collected automatically when you visit our websites or use our services.')),
    jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
      'Contact information such as name, business name, email address, phone number, mailing address, and account details.',
      'Business information you choose to add to the platform, including service offerings, website content, appointment details, contact records, estimates, invoices, notes, and uploaded files.',
      'Usage and device information such as IP address, browser type, pages viewed, referral data, and interaction events used to operate, secure, and improve the service.',
      'Communications data when you contact us, submit a form, request a demo, respond to emails, or otherwise communicate with Home Service Growth.'
    ))),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'How We Use Information')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We use collected information to operate the platform, provide customer support, improve the product, communicate with users, protect the service, and comply with legal obligations.')),
    jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
      'To create, maintain, and secure accounts and websites.',
      'To deliver product features such as lead capture, CRM records, scheduling, estimates, invoices, notifications, analytics, and automation workflows.',
      'To respond to inquiries, requests, and support issues.',
      'To monitor performance, investigate misuse, prevent fraud, and enforce our policies.',
      'To send product updates, transactional notices, service announcements, and other administrative communications.'
    ))),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Cookies, Analytics, and Similar Technologies')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We may use cookies, local storage, analytics tools, and similar technologies to keep users signed in, understand product and website performance, remember preferences, measure marketing effectiveness, and improve the overall experience.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'How We Share Information')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We do not sell personal information. We may share information only as needed to operate the service, comply with law, protect rights, or complete business transactions.')),
    jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
      'With service providers that help us host infrastructure, process email, analyze usage, provide integrations, support authentication, or otherwise operate the platform.',
      'With the customer account owner or authorized users within the same business workspace.',
      'When required by law, subpoena, legal process, or a good-faith belief that disclosure is necessary to protect users, Home Service Growth, or the public.',
      'In connection with a merger, acquisition, financing, reorganization, sale of assets, or similar transaction, subject to appropriate confidentiality and transition protections.'
    ))),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Data Retention')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We retain information for as long as reasonably necessary to provide the service, maintain records, resolve disputes, enforce agreements, and comply with legal obligations. Retention periods may vary depending on the type of data and the needs of the applicable account.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Data Security')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We use reasonable administrative, technical, and organizational safeguards designed to protect information from unauthorized access, loss, misuse, or alteration. No internet transmission or storage system is guaranteed to be completely secure, so we cannot guarantee absolute security.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Your Choices')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'You may update certain account information through the platform, request changes by contacting us, disable some browser-based tracking controls, and choose whether to provide certain optional information. Some data is required for account creation, product operation, security, and billing.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Third-Party Services and Links')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Our websites and platform may contain links to third-party websites or connect to third-party products. We are not responsible for the privacy practices or content of those third parties. Your use of third-party services is governed by their own terms and privacy policies.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Children''s Privacy')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Our services are intended for businesses and adults. We do not knowingly collect personal information directly from children under 13. If you believe a child has provided personal information to us, contact us so we can review and address the issue.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Changes to This Policy')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We may update this Privacy Policy from time to time. If we make material changes, we may update the effective date, post the revised policy on the website, or provide additional notice where appropriate. Continued use of the service after an updated policy becomes effective constitutes acceptance of the revised policy.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Contact Us')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If you have questions about this Privacy Policy or our data practices, contact Home Service Growth at brendan@hsgrowth.com.'))
  );

  v_terms_content := jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Effective date: March 27, 2026.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'These Terms of Service govern your access to and use of Home Service Growth websites, software, tools, content, and related services. By accessing or using the service, you agree to these Terms. If you do not agree, do not use the service.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Eligibility and Accounts')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'You may use the service only if you can form a binding contract on behalf of yourself or the business you represent. You are responsible for maintaining the confidentiality of account credentials and for all activity that occurs under your account.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Use of the Service')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Subject to these Terms, Home Service Growth grants you a limited, non-exclusive, non-transferable, revocable right to access and use the service for your internal business purposes.')),
    jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
      'You may not use the service to violate any law, regulation, or third-party right.',
      'You may not attempt to disrupt, probe, reverse engineer, or gain unauthorized access to the platform, accounts, servers, or connected systems.',
      'You may not upload or transmit harmful code, spam, deceptive content, or material that is unlawful, infringing, or abusive.',
      'You may not use the service in a way that interferes with other customers or with normal platform operation.'
    ))),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Customer Content and Data')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'You retain ownership of the information, files, records, and content you submit to the service. You grant Home Service Growth the rights reasonably necessary to host, process, transmit, back up, and display that content for the purpose of operating and improving the service. You represent that you have all rights needed to provide your content and that doing so does not violate any law or third-party right.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Fees and Billing')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If you purchase paid services, you agree to pay the fees, charges, taxes, and renewal amounts presented at the time of purchase or as otherwise agreed in writing. Unless stated otherwise, fees are non-refundable once the applicable service period begins, except where required by law or expressly stated by Home Service Growth.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Third-Party Services')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'The platform may include integrations, infrastructure providers, analytics services, payment services, mapping tools, email services, or other third-party functionality. Home Service Growth is not responsible for third-party products or services, and your use of those services may be subject to separate terms and policies.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Intellectual Property')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'The Home Service Growth service, including its software, design, trademarks, branding, workflows, and related materials, is owned by Home Service Growth or its licensors and is protected by intellectual property law. Except for the limited access rights expressly granted in these Terms, no rights are transferred to you.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Availability and Changes')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We may modify, suspend, or discontinue any part of the service at any time, with or without notice. We may also update features, limits, integrations, or functionality in the ordinary course of improving the platform.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Termination')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We may suspend or terminate access to the service if you violate these Terms, create security or legal risk, fail to pay applicable fees, or otherwise misuse the platform. You may stop using the service at any time. Sections that by their nature should survive termination will survive, including provisions relating to ownership, disclaimers, limitations of liability, payments owed, and dispute resolution.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Disclaimers')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'The service is provided on an "as is" and "as available" basis. To the fullest extent permitted by law, Home Service Growth disclaims all warranties, whether express, implied, statutory, or otherwise, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not guarantee uninterrupted service, complete accuracy, or that the platform will be free from errors or security incidents.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Limitation of Liability')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'To the fullest extent permitted by law, Home Service Growth and its affiliates, officers, employees, contractors, and licensors will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, data, goodwill, or business interruption arising out of or related to the service or these Terms. To the fullest extent permitted by law, our aggregate liability for claims arising out of or related to the service will not exceed the amount paid by you to Home Service Growth for the service during the twelve months preceding the event giving rise to the claim.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Indemnification')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'You agree to defend, indemnify, and hold harmless Home Service Growth and its affiliates, officers, employees, contractors, and licensors from and against claims, liabilities, damages, losses, and expenses arising out of or related to your use of the service, your content, your violation of these Terms, or your violation of any law or third-party right.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Governing Law')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'These Terms are governed by the laws of the State of Connecticut, without regard to its conflict of laws principles.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Changes to These Terms')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We may update these Terms from time to time. If we make material changes, we may post the revised Terms on the website, update the effective date, or provide additional notice where appropriate. Continued use of the service after updated Terms become effective constitutes acceptance of the revised Terms.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('level', 2, 'text', 'Contact')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If you have questions about these Terms, contact Home Service Growth at brendan@hsgrowth.com.'))
  );

  update public.pages
  set
    title = 'Privacy Policy',
    page_kind = null,
    content = v_privacy_content,
    show_in_nav = false,
    sort_order = 900,
    is_active = true,
    meta_title = 'Privacy Policy | Home Service Growth',
    meta_description = 'Read the Home Service Growth Privacy Policy for information about how our platform collects, uses, and protects data.',
    updated_at = v_now
  where business_id = v_business_id
    and slug = 'privacy-policy';

  if not found then
    insert into public.pages (
      id,
      business_id,
      title,
      slug,
      page_kind,
      content,
      show_in_nav,
      sort_order,
      is_active,
      meta_title,
      meta_description,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_business_id,
      'Privacy Policy',
      'privacy-policy',
      null,
      v_privacy_content,
      false,
      900,
      true,
      'Privacy Policy | Home Service Growth',
      'Read the Home Service Growth Privacy Policy for information about how our platform collects, uses, and protects data.',
      v_now,
      v_now
    );
  end if;

  update public.pages
  set
    title = 'Terms of Service',
    page_kind = null,
    content = v_terms_content,
    show_in_nav = false,
    sort_order = 910,
    is_active = true,
    meta_title = 'Terms of Service | Home Service Growth',
    meta_description = 'Review the Home Service Growth Terms of Service governing access to and use of our software platform and websites.',
    updated_at = v_now
  where business_id = v_business_id
    and slug = 'terms-of-service';

  if not found then
    insert into public.pages (
      id,
      business_id,
      title,
      slug,
      page_kind,
      content,
      show_in_nav,
      sort_order,
      is_active,
      meta_title,
      meta_description,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_business_id,
      'Terms of Service',
      'terms-of-service',
      null,
      v_terms_content,
      false,
      910,
      true,
      'Terms of Service | Home Service Growth',
      'Review the Home Service Growth Terms of Service governing access to and use of our software platform and websites.',
      v_now,
      v_now
    );
  end if;
end
$$;

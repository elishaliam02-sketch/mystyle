import { LEGAL } from "./config";
import type { he } from "./documents.he";

/**
 * The English documents. Typed as `typeof he`, so a section added to the
 * Hebrew original fails the build here until it has been translated — the same
 * contract the string tables use, applied to the text where a silently missing
 * translation would be worst.
 */
export const en: typeof he = {
  privacy: {
    title: "Privacy policy",
    summary:
      "Most of what you write in this app stays on your phone. What is kept in the cloud is kept only if you turned backup on or signed up with an email, and only for you. No ads, no trackers, and nothing sold to anyone.",
    sections: [
      {
        id: "who",
        heading: "Who is responsible",
        body: [
          `${LEGAL.appName} is operated by ${LEGAL.publisher}. For any privacy question, request or complaint, write to ${LEGAL.contactEmail}.`,
          `This document is effective from ${LEGAL.effective} and is version ${LEGAL.version}.`,
        ],
      },
      {
        id: "device",
        heading: "What never leaves your phone",
        body: [
          "Local is the default. Until you turn cloud backup on, none of this leaves the device:",
          "• Your training plan and its log — weights, sets, reps.",
          "• The food diary, the pantry you typed, water and steps.",
          "• Body measurements and the targets you set.",
          "• Progress photos. They are stored as files on the phone and are never uploaded — not even when backup is on.",
        ],
      },
      {
        id: "cloud",
        heading: "What is stored in the cloud, and only if you asked",
        body: [
          "If you turn on cloud backup or sign up with an email address, the following is stored in your account with our infrastructure provider:",
          "• Your email address and password (the password is stored hashed, never in the clear).",
          "• The name you entered, starting and goal weight, height, and whether reminders are on.",
          "• The habits you wrote, their daily ticks, your weigh-ins and evening recaps — including the free text you wrote in a recap.",
          "• A backup of the settings and logs listed in the previous section, so they follow you to your next phone.",
          "The infrastructure is provided by Supabase, whose servers may be outside your country. Access to your rows is restricted at the database level to your account alone.",
        ],
      },
      {
        id: "health",
        heading: "Health information",
        body: [
          "Weight, food, activity and mood are sensitive. They are therefore collected only on the basis of your explicit consent — the consent you gave on the opening screen — and you can withdraw it at any time from the profile screen.",
          "Withdrawing stops syncing immediately. What is already on the server is removed when you delete your account.",
        ],
      },
      {
        id: "ai",
        heading: "The AI coach and the meal photo scan",
        body: [
          "If you turn the AI coach on, the text of your question and the relevant numbers from your log are sent to our server, and from there to a language-model provider. If you photograph a meal, the photo is sent too, to estimate its calories.",
          "The providers used are Google (Gemini) and/or Anthropic (Claude), depending on what the server is configured with.",
          "Worth knowing: on Google's free tier, content sent may be reviewed by humans and used to improve their services. Do not send anything through the coach that you would not want reviewed.",
          "Without this consent the app still works in full: it falls back to the coach that runs on the device and to written content, and the screen always says which of the two you are reading.",
        ],
      },
      {
        id: "third",
        heading: "Who else sees anything",
        body: [
          "• Supabase — storage, accounts, and the function that talks to the model.",
          "• Expo (EAS Update) — when the app checks for an update, that server sees an IP address and basic device details.",
          "• YouTube — exercise demo thumbnails load from YouTube's servers, and a demo opens there. Loading or tapping one exposes your IP address to Google.",
          "• Wikimedia (commons.wikimedia.org, upload.wikimedia.org) — the pictures of the suggested meals are real photographs from Wikimedia Commons, looked up by the name of the dish. What is sent is that name, out of the app's own cookbook — for example \"chickpea stew\" — and never anything you wrote, photographed or measured. As with any request to a server, your IP address is exposed. You can switch this off in the profile screen (\"Photos of the meals\"); the app then shows the illustration drawn on the device and makes no request at all.",
          "There is no analytics tool in this app, no advertising SDK, and no advertising identifier. We do not sell or rent information to anyone.",
        ],
      },
      {
        id: "rights",
        heading: "Your rights",
        body: [
          "You are entitled to know what is held about you, to correct it, to receive a copy, to delete all of it, and to withdraw a consent you gave.",
          "A copy: the profile screen downloads everything as a JSON file — all of it, exactly as stored, with no wait for a reply to an email.",
          "Deletion: the profile screen has a delete-account button. It deletes the account and all of its rows from the server, and clears the data from the device. It cannot be undone.",
          `For anything else — a copy of your data, a correction, or a complaint — write to ${LEGAL.contactEmail} and we will deal with it within 30 days.`,
          "If you are in Israel or the EU, you also have the right to complain to your local supervisory authority.",
        ],
      },
      {
        id: "retention",
        heading: "How long it is kept",
        body: [
          "Account data is kept while the account exists. Deleting the account removes it immediately, apart from copies in operational backups which expire by themselves within 30 days.",
          "Data that stayed on the device is gone when you delete the app, or when you press reset in the profile screen.",
        ],
      },
      {
        id: "security",
        heading: "Security",
        body: [
          "All traffic to the server is encrypted with HTTPS. The sign-in token is kept in the device's encrypted keystore rather than in ordinary storage. Passwords are hashed on the server side and are not available to us. Database permissions are set so that one account cannot read another's rows.",
          "No security is perfect. If we learn of an incident that puts personal data at risk, we will notify the people affected and the relevant authority as the law requires.",
        ],
      },
      {
        id: "children",
        heading: "Children",
        body: [
          "This app is not intended for children under 16 and we do not knowingly collect information about them. If we learn that such an account was created, we will delete it.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to this document",
        body: [
          "If we change something material — what is collected, where it goes, or what you are being asked to consent to — we raise the version number, and the app asks you to accept again before you carry on.",
        ],
      },
    ],
  },

  terms: {
    title: "Terms of use",
    summary:
      "APEX is a tool for building a routine, not medical advice. You are responsible for what you do with its suggestions; we are responsible for the app working as described.",
    sections: [
      {
        id: "health",
        heading: "This is not medical advice",
        body: [
          "APEX is a routine and fitness app. It is not a doctor, a dietitian or a physiotherapist, and everything in it — training plans, calorie targets, and anything the AI coach says — is general information only.",
          "Before a significant change to how you eat or train, and especially if you have a medical condition, are pregnant, injured, or on medication, speak to a professional. If something hurts, stop.",
          "If you think you have a medical emergency, seek medical help immediately. Do not rely on this app.",
        ],
      },
      {
        id: "account",
        heading: "Your account",
        body: [
          "The account is personal. Keeping your password and your device safe is on you.",
          "You must be at least 16 to use the app.",
          "The information you enter should be your own. Do not enter another person's health information.",
        ],
      },
      {
        id: "use",
        heading: "Fair use",
        body: [
          "Do not attempt to break the security, reach anyone else's data, drive the service automatically at a rate that harms it, or use it for anything unlawful.",
          "The AI layer is rate-limited per account, so that one device cannot spend everyone's quota.",
        ],
      },
      {
        id: "ai",
        heading: "Model answers",
        body: [
          "Coach answers are generated by a language model. They can be wrong, imprecise, or unsuited to you. A calorie estimate from a photo is a rough guess, not a measurement.",
          "The app marks clearly what a model wrote and what came from written content. What to do about it stays your call.",
        ],
      },
      {
        id: "content",
        heading: "Content — ours and yours",
        body: [
          "APEX's code, design, text and food library are ours and protected by copyright. Do not copy or redistribute them without permission.",
          "What you write — habits, recaps, photos — stays yours. You give us a limited permission to store and process it solely in order to run the service for you, and nothing more.",
          "The app uses open-source libraries. Their licences are listed in the profile screen.",
        ],
      },
      {
        id: "updates",
        heading: "Updates and changes",
        body: [
          "The app can update itself: a new version of its content and code downloads in the background and is applied once you agree to restart. That is how fixes arrive quickly without waiting for a store review.",
          "We may change, add or remove features. If a change materially reduces the service, we will say so in the app.",
        ],
      },
      {
        id: "money",
        heading: "Payment",
        body: [
          "The app is currently free and contains no purchases. If a subscription is added later, these terms will be updated and you will be asked to accept them before any charge.",
        ],
      },
      {
        id: "liability",
        heading: "Liability",
        body: [
          "The service is provided as is. We do not promise that it will always be available, free of faults, or that its numbers are exact.",
          "To the fullest extent the law allows, we are not liable for indirect damage, lost profit, or harm caused by relying on content in the app.",
          "Nothing here removes rights you cannot waive under the consumer law that applies to you.",
        ],
      },
      {
        id: "end",
        heading: "Ending it",
        body: [
          "You can stop using the app at any time and delete your account from inside it. We may close an account that breaches these terms, normally after a warning.",
        ],
      },
      {
        id: "law",
        heading: "Governing law",
        body: [
          "These terms are governed by the laws of the State of Israel, and the competent courts in Israel have exclusive jurisdiction — unless the law where you live gives you the right to bring a claim in your local court.",
          `Questions about these terms: ${LEGAL.contactEmail}.`,
        ],
      },
    ],
  },
};

import type { SupportLibrary } from "./types";

export const supportEn: SupportLibrary = {
  water: {
    label: "Water",
    why: "Thirst disguises itself as hunger. A glass before a meal cuts the portion without any effort.",
    tips: [
      "Keep a full bottle where you actually pass during the day — not in the kitchen. What you see, you drink.",
      "Tie it to something that already happens: after brushing your teeth, before each coffee, when you sit down to work.",
      "Missed some? Don't catch up all at once. Just have the next glass on time.",
      "If water bores you, lemon, mint or ice changes it without adding sugar.",
    ],
    anchors: ["After I brush my teeth", "Before every coffee", "When I sit down to work", "When I get home"],
    smaller: ["Half a glass instead of a full one", "One glass a day, at a fixed time"],
  },

  movement: {
    label: "Movement",
    why: "A short walk that happens daily beats a big workout that happens fortnightly.",
    tips: [
      "Start with the version you'd do on a bad day. Ten minutes that happen beat an hour that doesn't.",
      "Put your shoes by the door the night before. Half the battle is the moment before starting.",
      "After a meal is the easiest window — you're already up, and there's nothing to overcome.",
      "Missed a day? Go tomorrow. Two in a row is what breaks a habit, not one.",
      "Music or a podcast you save only for walking — suddenly you look forward to it.",
    ],
    anchors: ["After lunch", "When I get home", "Before my morning shower", "After the school run"],
    smaller: ["Ten minutes instead of thirty", "One loop around the block", "Get off one stop early"],
  },

  cleanEating: {
    label: "Eating clean",
    why: "\"Clean\" isn't all or nothing. One steady change to one meal beats a perfect diet that lasts a fortnight.",
    tips: [
      "Don't remove — add. A vegetable beside every meal pushes the rest out on its own.",
      "The simplest plate rule: half vegetables, a quarter protein, a quarter carbs. Nothing to weigh.",
      "Shop the edges of the supermarket. That's where the unprocessed food lives; the inner aisles are mostly boxes.",
      "What isn't in the house doesn't get eaten at ten at night. The real decision happens at the shop.",
      "Start with one meal a day. When it sits, move to the second.",
    ],
    anchors: ["When I plate up", "Before I order food", "When I do the shopping", "Before I open the fridge"],
    smaller: ["One clean meal a day, not all of them", "Just add a vegetable — remove nothing"],
    meals: [
      {
        slot: "Breakfast",
        ideas: [
          "Boiled egg, tomato and cucumber, slice of wholemeal bread",
          "Plain yoghurt with nuts and fruit",
          "Omelette with cottage cheese and chopped vegetables",
          "Shakshuka with a side salad",
        ],
      },
      {
        slot: "Lunch",
        ideas: [
          "Chicken breast, rice, a big salad",
          "Tuna and egg over vegetables with wholemeal pitta",
          "Lentils or chickpeas with roasted vegetables",
          "Baked fish with sweet potato",
        ],
      },
      {
        slot: "Dinner",
        ideas: [
          "Big salad with feta and tuna",
          "Roasted vegetables with an egg",
          "Vegetable soup with pulses",
          "Yoghurt with chopped vegetables and olives",
        ],
      },
    ],
  },

  mealStructure: {
    label: "Regular meals",
    why: "Meals at steady times prevent the four o'clock hunger that wrecks the whole day.",
    tips: [
      "Three meals at similar times beat \"smart\" eating at random ones.",
      "Breakfast with protein holds until lunch. Without it you'll be hungry within the hour.",
      "Prepare tomorrow's meal tonight. The hard decision always lands when you're already hungry.",
      "Don't skip to \"save\" — it comes back double in the evening, and that's the hardest pattern to break.",
      "Eat sitting down, without a screen. Eating at your phone ends before you noticed it started.",
    ],
    anchors: ["When I wake up", "When I leave for work", "When I get home", "After I shut the laptop"],
    smaller: ["Just don't skip breakfast", "Fix the time of one meal only"],
    meals: [
      {
        slot: "Breakfast",
        ideas: [
          "Two eggs and salad",
          "Yoghurt, unsweetened granola, fruit",
          "Wholemeal bread with avocado and egg",
          "Cottage cheese with cherry tomatoes",
        ],
      },
      {
        slot: "Lunch",
        ideas: [
          "Protein + carb + salad — the same shape every day",
          "Last night's dinner, in a box",
          "Wholemeal pasta with tuna and vegetables",
          "A proper sandwich on wholemeal with protein and veg",
        ],
      },
      {
        slot: "Dinner",
        ideas: [
          "Something light that takes ten minutes — omelette, salad, yoghurt",
          "Roasted vegetables batched for three days",
          "Soup with pulses",
          "Fish and a vegetable side",
        ],
      },
    ],
  },

  snacking: {
    label: "Snacking",
    why: "Most snacking is a habit of a time and a place, not real hunger.",
    tips: [
      "Find the hour. For most people it's between four and five, or after nine at night.",
      "Don't fight the urge — replace it. Something planned at exactly that time works better than willpower.",
      "Water or tea first, then decide. Often it simply passes.",
      "The snack that isn't in the house doesn't get eaten. That's shopping, not discipline.",
      "If you do snack, put it in a bowl and sit down. Straight from the bag has no end.",
    ],
    anchors: ["When I feel the urge", "At four in the afternoon", "When I walk into the kitchen at night"],
    smaller: ["Swap one snack a day, not all of them", "Just sit down and eat from a bowl"],
    meals: [
      {
        slot: "Instead of a snack",
        ideas: [
          "Plain yoghurt with fruit",
          "A handful of almonds or nuts",
          "Carrot, cucumber or pepper, cut in advance in the fridge",
          "A boiled egg made ahead",
          "Home-made popcorn without butter",
        ],
      },
    ],
  },

  portions: {
    label: "Portions",
    why: "It isn't always what you eat — sometimes it's how much. And that's far easier to change.",
    tips: [
      "A smaller plate. It sounds silly and it works on everyone, including people who know it works.",
      "Serve from the pan to the plate and keep the pan off the table. Seconds are a habit of proximity.",
      "Eat slowly. Fullness arrives about twenty minutes late — whoever rushes always eats more.",
      "Put the fork down between bites. Sounds odd, cuts the amount without thinking about it.",
    ],
    anchors: ["When I serve food", "When I sit down to eat"],
    smaller: ["Just no second helping", "A smaller plate at one meal a day"],
  },

  sleep: {
    label: "Sleep",
    why: "A short night raises hunger the next day. Sleep isn't a luxury here, it's part of the work.",
    tips: [
      "A fixed lights-out time matters more than a fixed wake-up time.",
      "Phone outside the bedroom. If it's your alarm, an alarm clock costs almost nothing.",
      "Bright light in the morning does more for your body clock than any evening trick.",
      "Coffee after two in the afternoon is still in you at ten at night, even if you don't feel it.",
    ],
    anchors: ["After screens go off", "When I finish brushing my teeth", "Once the kids are asleep"],
    smaller: ["Fifteen minutes earlier, not an hour", "Just fix a lights-out time, change nothing else"],
  },

  screens: {
    label: "Screens",
    why: "The evening screen steals the sleep, and the sleep steals the day after.",
    tips: [
      "Put the charger outside the bedroom. The decision lands at eight, not at eleven.",
      "Last screen standing up, not in bed. Your body learns that the bed is for sleeping.",
      "A greyscale screen in the evening kills the pull surprisingly well.",
      "Replace it with something, not with nothing. A book, a shower, stretching — fill the gap.",
    ],
    anchors: ["After dinner", "At the time I set", "When I go into the bedroom"],
    smaller: ["Fifteen screen-free minutes instead of an hour", "Just get the phone out of the bed"],
  },

  general: {
    label: "Making it stick",
    why: "A habit sticks when it's small, steady, and attached to something that already happens.",
    tips: [
      "Attach it to something that happens daily regardless of you. That's the thread that holds it.",
      "Make it small enough to feel too easy. Growing is always possible; restarting is hard.",
      "One miss is nothing. Two in a row is what kills it — go back the very next day.",
      "When it isn't working, change the environment rather than the willpower. Willpower runs out; environment stays.",
      "Decide in advance what you'll do on a bad day. The minimum version has to exist before you need it.",
    ],
    anchors: ["After I wake up", "After lunch", "When I get home", "Before I go to sleep"],
    smaller: ["Half of what it is now", "Weekdays only, not weekends"],
  },
};

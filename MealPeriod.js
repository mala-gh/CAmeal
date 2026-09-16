(function () {
  "use strict";

  const MINUTES_PER_DAY = 24 * 60;

  function parseTime(value) {
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(":").map(Number);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function formatClock(totalMinutes) {
    const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function formatDuration(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
  }

  function calculateSchedule(startValue, endValue, firstMealMinutes) {
    const start = parseTime(startValue);
    let end = parseTime(endValue);
    const firstMeal = Number(firstMealMinutes);

    if (start === null || end === null) {
      return { error: "Enter a valid shift start and end time." };
    }
    if (![30, 45, 60].includes(firstMeal)) {
      return { error: "Choose a valid first meal length." };
    }

    let overnight = false;
    if (end <= start) {
      end += MINUTES_PER_DAY;
      overnight = true;
    }

    const elapsed = end - start;
    if (elapsed > MINUTES_PER_DAY) {
      return { error: "The shift cannot be longer than 24 hours." };
    }

    const firstRequired = elapsed > 5 * 60;
    const firstDeadline = start + 5 * 60;
    const firstWaiverEligible = firstRequired && elapsed <= 6 * 60;
    const workTimeIfOnlyFirstMeal = Math.max(0, elapsed - (firstRequired ? firstMeal : 0));
    const secondRequired = firstRequired && workTimeIfOnlyFirstMeal > 10 * 60;
    const secondDeadline = start + 10 * 60 + firstMeal;
    const secondWaiverEligible = secondRequired && workTimeIfOnlyFirstMeal <= 12 * 60;

    return {
      start,
      end,
      elapsed,
      overnight,
      firstMeal,
      firstRequired,
      firstDeadline,
      firstWaiverEligible,
      secondRequired,
      secondDeadline,
      secondWaiverEligible,
      workTimeIfOnlyFirstMeal,
    };
  }

  function resultForAgent(result) {
    if (result.error) return result;
    return {
      shift_duration_minutes: result.elapsed,
      crosses_midnight: result.overnight,
      first_meal_required: result.firstRequired,
      first_meal_latest_start: result.firstRequired ? formatClock(result.firstDeadline) : null,
      first_meal_waiver_may_be_available: result.firstWaiverEligible,
      second_meal_required: result.secondRequired,
      second_meal_latest_start: result.secondRequired ? formatClock(result.secondDeadline) : null,
      second_meal_waiver_may_be_available: result.secondWaiverEligible,
      reminder:
        "This general calculation is not legal advice. Confirm applicable wage-order, industry, occupation, and collective-bargaining rules.",
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseTime, formatClock, formatDuration, calculateSchedule, resultForAgent };
  }

  if (typeof document === "undefined") return;

  const form = document.getElementById("calculatorForm");
  const startInput = document.getElementById("startTime");
  const endInput = document.getElementById("endTime");
  const firstMealInput = document.getElementById("firstMealLength");
  const overnightHint = document.getElementById("overnightHint");
  const resultTitle = document.getElementById("resultTitle");
  const durationPill = document.getElementById("durationPill");
  const resultCards = document.getElementById("resultCards");
  const cardTemplate = document.getElementById("mealCardTemplate");
  const waiverPanel = document.getElementById("waiverPanel");
  const waiverTitle = document.getElementById("waiverTitle");
  const waiverText = document.getElementById("waiverText");
  const formError = document.getElementById("formError");
  const resetButton = document.getElementById("resetButton");

  function addMealCard(number, label, deadline, detail) {
    const card = cardTemplate.content.cloneNode(true);
    card.querySelector(".meal-number").textContent = number;
    card.querySelector(".meal-label").textContent = label;
    card.querySelector(".meal-time").textContent = formatClock(deadline);
    card.querySelector(".meal-detail").textContent = detail;
    resultCards.appendChild(card);
  }

  function render() {
    const result = calculateSchedule(startInput.value, endInput.value, firstMealInput.value);
    formError.hidden = true;

    if (result.error) {
      formError.textContent = result.error;
      formError.hidden = false;
      return;
    }

    overnightHint.textContent = result.overnight ? "(Ends next day)" : "(Same day)";
    durationPill.textContent = `${formatDuration(result.elapsed)} workday span`;
    resultCards.replaceChildren();
    waiverPanel.hidden = true;

    if (!result.firstRequired) {
      resultTitle.textContent = "No meal period required";
      const empty = document.createElement("div");
      empty.className = "no-meal";
      empty.innerHTML =
        "<strong>This workday is 5 hours or less.</strong>Under the general California rule, the first meal is required when work exceeds 5 hours.";
      resultCards.appendChild(empty);
      return;
    }

    addMealCard(
      "1",
      "First meal period",
      result.firstDeadline,
      "Start no later than the end of the 5th hour worked."
    );

    if (result.firstWaiverEligible) {
      resultTitle.textContent = "First meal required unless mutually waived";
      waiverPanel.hidden = false;
      waiverTitle.textContent = "First meal waiver may be available";
      waiverText.textContent =
        "The total workday does not exceed 6 hours. A waiver requires mutual consent between the employer and employee.";
    }

    if (!result.secondRequired) {
      if (!result.firstWaiverEligible) resultTitle.textContent = "One meal period required";
      return;
    }

    resultTitle.textContent = result.secondWaiverEligible
      ? "A second meal is due unless validly waived"
      : "Two meal periods required";
    addMealCard(
      "2",
      "Second meal period",
      result.secondDeadline,
      `Deadline excludes the planned ${result.firstMeal}-minute first meal.`
    );

    waiverPanel.hidden = false;
    if (result.secondWaiverEligible) {
      waiverTitle.textContent = "Second meal waiver may be available";
      waiverText.textContent =
        "Only by mutual consent, when total work time does not exceed 12 hours and the first meal was not waived.";
    } else {
      waiverTitle.textContent = "Second meal cannot be waived";
      waiverText.textContent =
        "Projected work exceeds 12 hours. Under the general rule, the second meal cannot be waived.";
    }
  }

  function reset() {
    startInput.value = "06:00";
    endInput.value = "14:30";
    firstMealInput.value = "30";
    render();
    startInput.focus();
  }

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  resetButton.addEventListener("click", reset);
  render();

  const context = document.modelContext;
  if (context?.registerTool) {
    try {
      void Promise.resolve(
        context.registerTool({
          name: "calculate_meal_periods",
          title: "Calculate meal periods",
          description:
            "Calculate general California meal-period requirements, waiver eligibility, and latest start times for a workday using 24-hour HH:MM times.",
          inputSchema: {
            type: "object",
            properties: {
              start_time: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
              end_time: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
              first_meal_minutes: { type: "integer", enum: [30, 45, 60] },
            },
            required: ["start_time", "end_time", "first_meal_minutes"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute(input) {
            const result = calculateSchedule(
              input?.start_time,
              input?.end_time,
              input?.first_meal_minutes
            );
            if (result.error) throw new Error(result.error);
            startInput.value = input.start_time;
            endInput.value = input.end_time;
            firstMealInput.value = String(input.first_meal_minutes);
            render();
            return resultForAgent(result);
          },
        })
      ).catch(function () {});
    } catch (_) {}
  }
})();

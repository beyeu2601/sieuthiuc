# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# General Rules

- Do not use emojis, icons in any response, code, documentation, commit message, or generated content.
- Do not use decorative AI-generated symbols, special Unicode separators, banners, or artificial formatting characters.
- Do not use AI-gen typographic Unicode characters. Replace them with ASCII equivalents: em dash and en dash (`—` `–`) become `-`; right arrow (`→`) becomes `->`; left-right arrow (`↔`) becomes `<->`; ellipsis (`…`) becomes `...`; double vertical bar (`‖`) becomes `||`. The section sign (`§`) is allowed because it is standard legal citation notation (e.g. HIPAA §164.312).
- Do not make assumptions when information is missing, unclear, or not explicitly defined in the source code, documentation, configuration, or user instruction.
- Do not generate speculative implementations, architectures, behaviors, or conclusions without evidence from the provided sources.
- Do not invent new hypotheses, undocumented logic, hidden business rules, or inferred system behavior when working from provided source code or referenced documentation.
- Always prioritize existing source code, official documentation, provided references, and explicit user instructions over inferred interpretations.
- Keep writing style natural and human-readable. Avoid AI-style formatting patterns, overly structured assistant tone, generic AI phrasing, or repetitive template wording.
- Keep explanations concise, direct, and implementation-focused.
- Preserve existing project conventions, naming standards, architecture patterns, and coding style unless explicitly instructed otherwise.
- When uncertain, explicitly state the uncertainty and request clarification instead of guessing.
- For Markdown (`.md`) files:
  - Do not insert unnecessary horizontal separators or empty break lines between sections.
  - Do not use emojis, icons in any response, code, documentation, commit message, or generated content.
  - Maintain a clean human-readable documentation flow.
  - Always include a `Table of Contents` section at the beginning of the document.
  - Use consistent heading hierarchy.
  - Keep formatting simple and maintainable.

---


## Behavioral Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
### 5. Reading
Trước khi sửa code, đọc docs/HE-THONG.md

### 6. Deploy
after complete fixing an issues (update functions, add features, fix bugs), deploy to prod

### 7. Holistic, human-centric design
Khi phân tích hoặc đề xuất bất kỳ tính năng nào, luôn áp dụng tư duy Thiết kế Toàn diện (Holistic Design) và Lấy con người làm trung tâm (Human-centric). Bắt buộc phân tích cụ thể mọi giải pháp qua 8 yếu tố:
- UX/UI Analysis: luồng thao tác, số bước, bố cục, trạng thái rỗng/lỗi/đang tải, nhất quán với màn hình hiện có.
- Psychology: động lực, tải nhận thức, thói quen, cảm giác tin cậy của người dùng 
- Physiology: bối cảnh dùng thật - điện thoại một tay, màn hình nhỏ, ánh sáng, mỏi mắt, thao tác nhanh giữa giờ dạy.
- Design Thinking: vấn đề thật của ai, bằng chứng nào, có cách đơn giản hơn không.
- Gamification: có cơ chế khuyến khích nào hợp lý không; nếu không phù hợp thì nói rõ và không thêm.
- Data Analytics: dựa trên số liệu thật (nhật ký, database prod), đo thành công bằng chỉ số nào.
- Business Strategy: tác động tới vận hành, doanh thu, chi phí, khối lượng việc của user/nhân sự.
- Accessibility: tương phản, cỡ chữ, vùng chạm, bàn phím, trình đọc màn hình.

Yếu tố nào không áp dụng thì ghi một dòng lý do, không bịa nội dung cho đủ. Phân tích rộng nhưng triển khai vẫn theo mục 2 (Simplicity First): chỉ làm phần đã được đồng ý.
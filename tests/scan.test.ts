import { beforeEach, describe, expect, it } from 'vitest';
import { scanFields } from '../src/content/scan';

// jsdom has no layout engine, so skip the getClientRects() visibility check.
const scan = () => scanFields(document, false);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('scanFields', () => {
  it('reads labels from for=, wrapping labels, aria-label and placeholder', () => {
    document.body.innerHTML = `
      <form>
        <label for="fn">First Name <span>*</span></label><input id="fn" name="first_name" required>
        <label>Email <input type="email" name="email"></label>
        <input aria-label="Phone" type="tel">
        <input placeholder="LinkedIn URL" type="url">
      </form>`;
    const fields = scan();
    expect(fields.map((f) => [f.info.kind, f.info.label])).toEqual([
      ['text', 'First Name'],
      ['email', 'Email'],
      ['tel', 'Phone'],
      ['url', 'LinkedIn URL'],
    ]);
    expect(fields[0].info.required).toBe(true);
    expect(fields[0].info.hints).toContain('first name');
  });

  it('falls back to nearby question text', () => {
    document.body.innerHTML = `<div><div class="q">Why do you want to join us?</div><div><textarea name="q1"></textarea></div></div>`;
    expect(scan()[0].info).toMatchObject({ kind: 'textarea', label: 'Why do you want to join us?' });
  });

  it('skips hidden, disabled, readonly and button inputs', () => {
    document.body.innerHTML = `
      <input type="hidden" name="token">
      <input name="a" disabled>
      <input name="b" readonly>
      <input name="c" style="display:none">
      <input type="submit" value="Submit">
      <label for="ok">Ok</label><input id="ok">`;
    expect(scan().map((f) => f.info.label)).toEqual(['Ok']);
  });

  it('lists select options without the placeholder', () => {
    document.body.innerHTML = `
      <label for="c">Country</label>
      <select id="c"><option value="">Select...</option><option>India</option><option>United States</option></select>`;
    expect(scan()[0].info).toMatchObject({ kind: 'select', label: 'Country', options: ['India', 'United States'] });
  });

  it('groups radios under the fieldset legend', () => {
    document.body.innerHTML = `
      <fieldset>
        <legend>Have you worked at Acme before?</legend>
        <label><input type="radio" name="worked" value="1"> Yes</label>
        <label><input type="radio" name="worked" value="0"> No</label>
      </fieldset>`;
    const f = scan();
    expect(f).toHaveLength(1);
    expect(f[0].info).toMatchObject({ kind: 'radio', label: 'Have you worked at Acme before?', options: ['Yes', 'No'] });
    expect(f[0].els).toHaveLength(2);
  });

  it('finds the question for radios without a fieldset', () => {
    document.body.innerHTML = `
      <div class="field">
        <p>Do you require visa sponsorship?</p>
        <input type="radio" name="sp" id="sp-y" value="y"><label for="sp-y">Yes</label>
        <input type="radio" name="sp" id="sp-n" value="n"><label for="sp-n">No</label>
      </div>`;
    expect(scan()[0].info).toMatchObject({ kind: 'radio', label: 'Do you require visa sponsorship?', options: ['Yes', 'No'] });
  });

  it('treats a lone checkbox as its own question', () => {
    document.body.innerHTML = `<label><input type="checkbox" name="consent"> I agree to the privacy policy</label>`;
    expect(scan()[0].info).toMatchObject({ kind: 'checkbox', label: 'I agree to the privacy policy', options: [] });
  });

  it('includes file inputs even when visually hidden', () => {
    document.body.innerHTML = `<label for="r">Resume/CV</label><input type="file" id="r" style="display:none">`;
    expect(scan()[0].info).toMatchObject({ kind: 'file', label: 'Resume/CV' });
  });

  it("ignores EasyApply's own UI and keeps page order", () => {
    document.body.innerHTML = `
      <label for="a">A</label><input id="a">
      <fieldset><legend>B</legend><label><input type="radio" name="b"> x</label><label><input type="radio" name="b"> y</label></fieldset>
      <label for="c">C</label><input id="c">
      <div data-easyapply><input aria-label="ours"></div>`;
    expect(scan().map((f) => f.info.label)).toEqual(['A', 'B', 'C']);
  });
});

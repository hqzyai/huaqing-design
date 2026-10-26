// @vitest-environment jsdom

import { createRef, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../src/button';
import { Input, Select, Textarea } from '../src/form-controls';

afterEach(cleanup);

describe('UI primitive native contracts', () => {
  it('retains the non-submitting Button default and explicit submit behavior', () => {
    const submitted = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={submitted}>
        <Button>Cancel</Button>
        <Button type="submit">Save</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(submitted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('preserves external form ownership and native serialization', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <>
        <form id="preferences">
          <Textarea name="notes" defaultValue="Keep this draft" />
          <Select name="items" multiple size={3} defaultValue={['one', 'three']}>
            <option value="one">One</option>
            <option value="two">Two</option>
            <option value="three">Three</option>
          </Select>
          <Input name="ignored" defaultValue="disabled" disabled />
        </form>
        <Input ref={ref} form="preferences" name="title" defaultValue="Outside" />
      </>,
    );
    const form = document.getElementById('preferences') as HTMLFormElement;
    expect(ref.current?.form).toBe(form);
    expect([...new FormData(form).entries()]).toEqual([
      ['notes', 'Keep this draft'], ['items', 'one'], ['items', 'three'], ['title', 'Outside'],
    ]);
    expect(screen.getByRole('listbox').getAttribute('size')).toBe('3');
  });

  it('keeps uncontrolled drafts through rerenders and supports native reset', () => {
    const { rerender, container } = render(
      <form><Input aria-label="Title" defaultValue="Initial" /><Textarea aria-label="Notes" defaultValue="Notes" /></form>,
    );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Draft' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Edited' } });
    rerender(
      <form><Input aria-label="Title" defaultValue="Initial" className="custom" /><Textarea aria-label="Notes" defaultValue="Notes" /></form>,
    );
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Draft');
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Edited');
    container.querySelector('form')?.reset();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Initial');
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Notes');
  });

  it('forwards refs, IME events and one native change event to the existing state owner', () => {
    const ref = createRef<HTMLInputElement>();
    const events = vi.fn();
    const composition = vi.fn();
    function Form() {
      const [value, setValue] = useState('');
      return <Input ref={ref} name="title" aria-label="Title" value={value}
        onCompositionStart={composition} onCompositionEnd={composition}
        onChange={(event) => {
          events(event.target.name, event.currentTarget.value, event.currentTarget === ref.current);
          setValue(event.target.value);
        }} />;
    }
    render(<Form />);
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
    fireEvent.compositionStart(ref.current!);
    fireEvent.change(ref.current!, { target: { value: '你好' } });
    fireEvent.compositionEnd(ref.current!);
    expect(events).toHaveBeenCalledExactlyOnceWith('title', '你好', true);
    expect(composition).toHaveBeenCalledTimes(2);
    expect(ref.current?.value).toBe('你好');
  });

  it('keeps disabled actions inert and refs pointed at the original DOM element types', () => {
    const button = createRef<HTMLButtonElement>();
    const textarea = createRef<HTMLTextAreaElement>();
    const select = createRef<HTMLSelectElement>();
    const clicked = vi.fn();
    render(<>
      <Button ref={button} disabled onClick={clicked}>Unavailable</Button>
      <Textarea ref={textarea} readOnly defaultValue="Read only" />
      <Select ref={select}><option value="one">One</option></Select>
    </>);
    button.current?.click();
    expect(clicked).not.toHaveBeenCalled();
    expect(button.current?.tagName).toBe('BUTTON');
    expect(textarea.current?.tagName).toBe('TEXTAREA');
    expect(select.current?.tagName).toBe('SELECT');
  });
});

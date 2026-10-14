import { useEffect, useRef } from 'react';

interface Props {
  onChoose: (mode: 'tour' | 'playground') => void;
}

/** Shown when the app loads: what this is, and where to start. Escape goes to the playground. */
export function WelcomeDialog({ onChoose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const choose = (mode: 'tour' | 'playground') => {
    ref.current?.close();
    onChoose(mode);
  };

  return (
    <dialog
      ref={ref}
      className="welcome"
      aria-labelledby="welcome-title"
      onCancel={(e) => {
        e.preventDefault();
        choose('playground');
      }}
    >
      <h2 id="welcome-title">Welcome to the GPU Scheduler Playground</h2>
      <p>
        This app shows how AI models get placed onto a cluster of GPU machines, and why a model
        deployment can stall even when plenty of GPUs look free.
      </p>
      <p>
        You'll see how two common placement strategies, <strong>binpack</strong> and{' '}
        <strong>spread</strong>, trade efficient use of GPUs against how much a single machine
        failure can disrupt.
      </p>

      <div className="welcome-options">
        <button className="welcome-option primary" onClick={() => choose('tour')} autoFocus>
          <span className="welcome-option-title">Start the guided tour</span>
          <span className="welcome-option-text">
            A short, step-by-step walkthrough of the key ideas. Start here if this is new to you.
          </span>
        </button>
        <button className="welcome-option" onClick={() => choose('playground')}>
          <span className="welcome-option-title">Explore the playground</span>
          <span className="welcome-option-text">
            Deploy, scale and upgrade models, and take machines down, on your own.
          </span>
        </button>
      </div>
      <p className="welcome-note">You can switch between the two any time with the tabs at the top.</p>
    </dialog>
  );
}

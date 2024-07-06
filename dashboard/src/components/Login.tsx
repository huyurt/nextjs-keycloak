'use client'
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function Login() {
  const [username, setUsername] = useState('hyurt');
  const [password, setPassword] = useState('admin');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior.
    const res = await signIn('credentials', {
      username,
      password,
    });

    if (!res?.error) {
    } else {
      console.error('Invalid username or password');
    }
  };

  return <form onSubmit={onSubmit}>
    <div>
      <label>
        Username:
      </label>
      <input
        required
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
    </div>
    <div>
      <label>
        Password:
      </label>
      <input
        required
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </div>
    <button
      type="submit"
      className="bg-sky-500 hover:bg-sky-700 px-5 py-2 text-sm leading-5 rounded-full font-semibold text-white">
      Signin
    </button>
  </form>
}

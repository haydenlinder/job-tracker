"use client"
import Image from "next/image";
import { SubmitEventHandler } from "react";
import ButtonPrimary from "./ButtonPrimary";


export default function Home() {

  const handleSubmit: SubmitEventHandler<HTMLButtonElement>  = (e) => {
    e.preventDefault()
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <ButtonPrimary onSubmit={handleSubmit}>Log in with google</ButtonPrimary>
      </main>
    </div>
  );
}

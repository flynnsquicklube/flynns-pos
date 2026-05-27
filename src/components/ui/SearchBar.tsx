import { Search } from "lucide-react";
import { Input } from "./Input";
import type { InputHTMLAttributes } from "react";

export function SearchBar(props: InputHTMLAttributes<HTMLInputElement>) {
  return <Input inputSize="touch" leftIcon={<Search size={20} />} {...props} />;
}

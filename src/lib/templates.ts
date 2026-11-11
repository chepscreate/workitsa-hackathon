"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { CategoryId } from "./types";

export type JobTemplate = {
  id: string;
  name: string;
  title: string;
  description: string;
  category: CategoryId;
  suggestedPrice: number;
  suburb?: string;
  city?: string;
  province?: string;
  createdAt: number;
};

export async function saveTemplate(
  uid: string,
  template: Omit<JobTemplate, "id" | "createdAt">,
): Promise<string> {
  const ref = await addDoc(collection(getDb(), "users", uid, "templates"), {
    ...template,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function listTemplates(uid: string): Promise<JobTemplate[]> {
  const snap = await getDocs(
    query(collection(getDb(), "users", uid, "templates"), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JobTemplate, "id">) }));
}

export async function deleteTemplate(uid: string, templateId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "users", uid, "templates", templateId));
}

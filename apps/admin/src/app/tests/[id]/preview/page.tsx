"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Progress } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import type { AdminQuestion, AdminTestDetail } from "@/lib/admin-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function optionLabel(question: AdminQuestion, optionIndex: number) {
  return question.options[optionIndex]?.label ?? `Option ${optionIndex + 1}`;
}

function QuestionPreview({ question }: { question: AdminQuestion }) {
  if (question.type === "RATING") {
    const min = typeof question.config.min === "number" ? question.config.min : 1;
    const max = typeof question.config.max === "number" ? question.config.max : 5;
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((value) => (
          <button key={value} disabled className="rounded-md border border-border px-4 py-2 text-sm">
            {value}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "FREE_TEXT") {
    return <textarea className="min-h-32 w-full rounded-md border border-border bg-background p-3 text-sm" disabled />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {question.options.map((option, index) => (
        <button key={option.id} disabled className="overflow-hidden rounded-lg border border-border text-left">
          {option.mediaId && question.mediaType === "IMAGE" && (
            <img
              src={`${API_URL}/media/${option.mediaId}/file`}
              alt={optionLabel(question, index)}
              className="aspect-video w-full object-cover"
            />
          )}
          {option.mediaId && question.mediaType !== "IMAGE" && (
            <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">
              {question.mediaType} media
            </div>
          )}
          <div className="p-3 text-sm font-medium">{optionLabel(question, index)}</div>
        </button>
      ))}
    </div>
  );
}

export default function TestPreviewPage() {
  const params = useParams<{ id: string }>();
  const [test, setTest] = useState<AdminTestDetail | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const data = await apiFetch<AdminTestDetail>(`/admin/tests/${params.id}/preview`);
        setTest(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load preview");
      }
    }
    void load();
  }, [params.id]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!test) return <p className="text-sm text-muted-foreground">Loading preview...</p>;

  const question = test.questions[index];
  const progress = test.questions.length > 0 ? ((index + 1) / test.questions.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{test.title}</h1>
            <Badge>{test.status}</Badge>
            <Badge>{test.rewardPoints} pts</Badge>
          </div>
          <p className="text-muted-foreground">{test.description || "No description provided."}</p>
        </div>
        <Link href={`/tests/${test.id}/edit`}><Button variant="secondary">Back to Editor</Button></Link>
      </div>

      {test.questions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">This test has no questions.</CardContent>
        </Card>
      ) : question ? (
        <Card>
          <CardHeader>
            <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>Question {index + 1} of {test.questions.length}</span>
              <span>{test.advisoryTimeMin ?? "-"} min advisory</span>
            </div>
            <Progress value={progress} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{question.type}</Badge>
              {question.mediaType && <Badge>{question.mediaType}</Badge>}
              {question.isAttentionCheck && <Badge>Attention</Badge>}
              {question.isTrapDuplicate && <Badge>Trap</Badge>}
            </div>
            <CardTitle className="pt-2">{question.prompt}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <QuestionPreview question={question} />
            <div className="flex justify-between gap-2">
              <Button variant="secondary" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}>
                Previous
              </Button>
              <Button onClick={() => setIndex((current) => Math.min(test.questions.length - 1, current + 1))} disabled={index === test.questions.length - 1}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Progress,
} from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { statusVariant } from "@/lib/status";
import type { AdminQuestion, AdminTestDetail } from "@/lib/admin-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function optionLabel(question: AdminQuestion, optionIndex: number) {
  return question.options[optionIndex]?.label ?? `Option ${optionIndex + 1}`;
}

function QuestionPreview({ question }: { question: AdminQuestion }) {
  if (question.type === "RATING") {
    const min = typeof question.config.min === "number" ? question.config.min : 1;
    const max = typeof question.config.max === "number" ? question.config.max : 5;
    const subject = question.options[0];
    return (
      <div className="space-y-4">
        {subject && (
          <div className="overflow-hidden rounded-lg border-2 border-border">
            {subject.mediaId && question.mediaType === "IMAGE" && (
              <img
                src={`${API_URL}/media/${subject.mediaId}/file`}
                alt={subject.label ?? "Rating subject"}
                className="aspect-video w-full bg-muted object-cover"
              />
            )}
            {subject.mediaId && (question.mediaType === "VIDEO" || question.mediaType === "AUDIO") && (
              <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">
                {question.mediaType} media
              </div>
            )}
            {subject.label && (
              <div className="px-3 py-2.5 text-sm font-medium">{subject.label}</div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((value) => (
            <button
              key={value}
              type="button"
              disabled
              className="min-h-12 min-w-12 rounded-lg border-2 border-border text-base font-bold tabular-nums"
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {question.options.map((option, index) => (
        <button
          key={option.id}
          type="button"
          disabled
          className="overflow-hidden rounded-lg border-2 border-border text-left"
        >
          {option.mediaId && question.mediaType === "IMAGE" && (
            <img
              src={`${API_URL}/media/${option.mediaId}/file`}
              alt={optionLabel(question, index)}
              className="aspect-video w-full bg-muted object-cover"
            />
          )}
          {option.mediaId && question.mediaType !== "IMAGE" && (
            <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">
              {question.mediaType} media
            </div>
          )}
          <div className="px-3 py-2.5 text-sm font-medium">{optionLabel(question, index)}</div>
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

  if (error) return <Alert>{error}</Alert>;
  if (!test) return <p className="text-sm text-muted-foreground">Loading preview...</p>;

  const question = test.questions[index];
  const progress = test.questions.length > 0 ? ((index + 1) / test.questions.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-page-title text-foreground">{test.title}</h1>
            <Badge variant={statusVariant(test.status)}>{test.status}</Badge>
            <Badge variant="primary">{test.rewardPoints} pts</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {test.description || "No description provided."}
          </p>
        </div>
        <Link href={`/tests/${test.id}/edit`}>
          <Button variant="secondary">Back to Editor</Button>
        </Link>
      </div>

      {test.questions.length === 0 ? (
        <EmptyState title="No questions" description="This test has no questions yet." />
      ) : question ? (
        <Card className="mx-auto max-w-2xl">
          <div className="space-y-2 border-b border-border p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                Question <span className="tabular-nums">{index + 1}</span> of{" "}
                <span className="tabular-nums">{test.questions.length}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {test.advisoryTimeMin ?? "-"} min advisory
              </span>
            </div>
            <Progress value={progress} />
          </div>

          <CardContent className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              <Badge>{question.type.replace("_", " ").toLowerCase()}</Badge>
              {question.mediaType && <Badge>{question.mediaType.toLowerCase()}</Badge>}
              {question.isAttentionCheck && <Badge variant="warning">Attention</Badge>}
              {question.isTrapDuplicate && <Badge variant="warning">Trap</Badge>}
            </div>

            <h2 className="text-xl font-semibold leading-snug text-foreground">{question.prompt}</h2>

            <QuestionPreview question={question} />

            <div className="flex justify-between gap-2 border-t border-border pt-5">
              <Button
                variant="secondary"
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
                disabled={index === 0}
              >
                <ArrowLeft className="size-4" aria-hidden />
                Previous
              </Button>
              <Button
                onClick={() => setIndex((current) => Math.min(test.questions.length - 1, current + 1))}
                disabled={index === test.questions.length - 1}
              >
                Next
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

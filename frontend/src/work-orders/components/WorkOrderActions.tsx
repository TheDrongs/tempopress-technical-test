import { useState } from "react";
import type { ReactNode } from "react";
import { CheckCheck, Play, Send, UserRoundCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input, Select } from "../../components/ui/input";
import { Feedback, FieldMessage, Spinner } from "../../components/ui/feedback";
import { useFormValidation } from "../../lib/use-form-validation";
import type { User } from "../../types/user.types";
import type { WorkOrderCommand, WorkOrderDetail } from "../work-order.types";
import { formatDate, localDateTime } from "../work-order.utils";

export function WorkOrderActions({
  order,
  actor,
  users,
  pending,
  onAction,
}: {
  order: WorkOrderDetail;
  actor: User;
  users: User[];
  pending: boolean;
  onAction: (command: WorkOrderCommand) => Promise<void>;
}) {
  const [mechanicId, setMechanicId] = useState("");
  const [spvId, setSpvId] = useState("");
  const [endDate, setEndDate] = useState(() =>
    localDateTime(
      new Date(
        Math.max(Date.now(), Date.parse(order.startDate ?? "") || 0),
      ).toISOString(),
    ),
  );
  const validation = useFormValidation();
  const mechanics = users.filter((user) => user.role === "MECHANIC");
  const supervisors = users.filter((user) => user.role === "SPV");
  const recipientId = supervisors.length === 1 ? supervisors[0].id : spvId;
  function buttons(primary: ReactNode) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        {primary}
      </div>
    );
  }

  let content: ReactNode = null;

  if (actor.role === "ADMIN" && order.status === "DRAFT") {
    content = (
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            pending ||
            !validation.report(
              recipientId
                ? {}
                : { "spv-recipient": "Pilih SPV tujuan Work Order." },
            )
          )
            return;
          void onAction({ type: "submit", id: order.id, spvId: recipientId });
        }}
      >
        {supervisors.length !== 1 && (
          <div>
            <label
              htmlFor="spv-recipient"
              className="mb-1.5 block text-xs font-medium"
            >
              SPV tujuan
            </label>
            <Select
              id="spv-recipient"
              {...validation.fieldProps("spv-recipient")}
              value={spvId}
              disabled={pending}
              onChange={(event) => {
                setSpvId(event.target.value);
                validation.clear("spv-recipient");
              }}
            >
              <option value="">Pilih SPV...</option>
              {supervisors.map((user) => (
                <option value={user.id} key={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
            <FieldMessage
              id="spv-recipient"
              message={validation.inlineMessage("spv-recipient")}
            />
          </div>
        )}
        {buttons(
          <Button type="submit" disabled={pending || supervisors.length === 0}>
            {pending ? (
              <Spinner label="Mengirim..." />
            ) : (
              <>
                <Send />
                Submit Work Order
              </>
            )}
          </Button>,
        )}
      </form>
    );
  } else if (actor.role === "SPV" && order.status === "SUBMITTED") {
    content = (
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            pending ||
            !validation.report(
              mechanicId
                ? {}
                : {
                    "assigned-mechanic": "Pilih mechanic yang akan ditugaskan.",
                  },
            )
          )
            return;
          void onAction({ type: "assign", id: order.id, mechanicId });
        }}
      >
        <div>
          <label
            htmlFor="assigned-mechanic"
            className="mb-1.5 block text-xs font-medium"
          >
            Pilih mechanic
          </label>
          <Select
            id="assigned-mechanic"
            {...validation.fieldProps("assigned-mechanic")}
            value={mechanicId}
            disabled={pending}
            onChange={(event) => {
              setMechanicId(event.target.value);
              validation.clear("assigned-mechanic");
            }}
          >
            <option value="">Pilih mechanic</option>
            {mechanics.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
          <FieldMessage
            id="assigned-mechanic"
            message={validation.inlineMessage("assigned-mechanic")}
          />
        </div>
        {buttons(
          <Button type="submit" disabled={pending || mechanics.length === 0}>
            {pending ? (
              <Spinner label="Menyimpan..." />
            ) : (
              <>
                <UserRoundCheck />
                Tugaskan Mechanic
              </>
            )}
          </Button>,
        )}
      </form>
    );
  } else if (
    actor.role === "MECHANIC" &&
    actor.id === order.assignedMechanicId &&
    order.status === "READY_TO_WORK"
  ) {
    content = buttons(
      <Button
        disabled={pending}
        onClick={() => {
          void onAction({ type: "start", id: order.id });
        }}
      >
        {pending ? (
          <Spinner label="Memulai..." />
        ) : (
          <>
            <Play />
            Mulai Bekerja
          </>
        )}
      </Button>,
    );
  } else if (actor.role === "ADMIN" && order.status === "WORKING") {
    content = (
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const parsed = new Date(endDate);
          if (
            !endDate ||
            Number.isNaN(parsed.getTime()) ||
            parsed.getTime() < Date.parse(order.startDate!)
          ) {
            validation.report({
              "completion-date":
                "Waktu selesai wajib valid dan tidak boleh lebih awal dari waktu mulai.",
            });
            return;
          }
          validation.report({});
          void onAction({
            type: "complete",
            id: order.id,
            endDate: parsed.toISOString(),
          });
        }}
      >
        <div>
          <label
            htmlFor="completion-date"
            className="mb-1.5 block text-xs font-medium"
          >
            Waktu selesai (waktu lokal)
          </label>
          <Input
            id="completion-date"
            {...validation.fieldProps("completion-date")}
            type="datetime-local"
            step="0.001"
            value={endDate}
            min={localDateTime(order.startDate!)}
            disabled={pending}
            onChange={(event) => {
              setEndDate(event.target.value);
              validation.clear("completion-date");
            }}
            aria-describedby={[
              "completion-hint",
              validation.fieldProps("completion-date")["aria-describedby"],
            ]
              .filter(Boolean)
              .join(" ")}
          />
          <FieldMessage
            id="completion-date"
            message={validation.inlineMessage("completion-date")}
          />
          <p
            id="completion-hint"
            className="mt-1 text-xs text-muted-foreground"
          >
            Mulai: {formatDate(order.startDate, true)}
          </p>
        </div>
        {buttons(
          <Button type="submit" disabled={pending}>
            {pending ? (
              <Spinner label="Menyelesaikan..." />
            ) : (
              <>
                <CheckCheck />
                Selesaikan Work Order
              </>
            )}
          </Button>,
        )}
      </form>
    );
  }

  return (
    <footer className="shrink-0 space-y-3 border-t bg-white px-5 py-4 sm:px-7">
      {validation.generalMessage && (
        <Feedback>{validation.generalMessage}</Feedback>
      )}
      {content}
    </footer>
  );
}

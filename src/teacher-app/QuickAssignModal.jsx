import Modal from "../components/Modal.jsx";
import TeacherAssignView from "./TeacherAssignView.jsx";

// "오늘 명단"에서 학생 1명에게 바로 할 일을 추가하는 팝업. 반/할 일 만들기 탭으로 이동할 필요 없이,
// 그 학생·그 반으로 고정된 채로 TeacherAssignView의 폼을 그대로 재사용합니다.
export default function QuickAssignModal({ data, updateData, myCourses, currentTeacherId, student, courseId, onClose }) {
  return (
    <Modal title={`${student.name} · 오늘 할 일 추가`} onClose={onClose} width={420}>
      <TeacherAssignView
        data={data}
        updateData={updateData}
        myCourses={myCourses}
        currentTeacherId={currentTeacherId}
        lockedStudent={{ id: student.id, name: student.name, courseId }}
        embedded
        onDone={onClose}
      />
    </Modal>
  );
}

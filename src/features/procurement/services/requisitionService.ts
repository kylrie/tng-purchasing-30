import {
    collection,
    doc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where
} from "firebase/firestore";
import { db } from "../../../config/firebase";
import { RequisitionStatus } from "../types";
import type { Requisition } from "../types";

const REQUISITIONS_COLLECTION = "requisitions";

export const fetchRequisitions = async (businessId?: string): Promise<Requisition[]> => {
    try {
        const reqsRef = collection(db, REQUISITIONS_COLLECTION);
        let q;

        if (businessId) {
            q = query(reqsRef, where("businessId", "==", businessId));
        } else {
            q = query(reqsRef);
        }

        const querySnapshot = await getDocs(q);
        const reqs: Requisition[] = [];
        querySnapshot.forEach((doc) => {
            reqs.push(doc.data() as Requisition);
        });
        return reqs;
    } catch (error) {
        console.error("Error fetching requisitions:", error);
        return [];
    }
};

export const createRequisition = async (requisition: Requisition) => {
    try {
        await setDoc(doc(db, REQUISITIONS_COLLECTION, requisition.id), requisition);
        return true;
    } catch (e) {
        console.error("Error adding document: ", e);
        return false;
    }
};

export const updateRequisitionStatus = async (id: string, status: RequisitionStatus) => {
    try {
        const reqRef = doc(db, REQUISITIONS_COLLECTION, id);
        await updateDoc(reqRef, { status: status });
        return true;
    } catch (e) {
        console.error("Error updating status: ", e);
        return false;
    }
};

export const updateRequisition = async (requisition: Requisition) => {
    try {
        const reqRef = doc(db, REQUISITIONS_COLLECTION, requisition.id);
        await setDoc(reqRef, requisition, { merge: true });
        return true;
    } catch (e) {
        console.error("Error updating requisition: ", e);
        return false;
    }
};

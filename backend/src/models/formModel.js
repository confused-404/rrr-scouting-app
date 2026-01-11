// In-memory storage (will be replaced with Firebase later)
let forms = [];
let submissions = [];

export const formModel = {
  // Form CRUD operations
  getAllForms: () => forms,
  
  getFormById: (id) => forms.find(form => form.id === id),
  
  createForm: (formData) => {
    const newForm = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...formData
    };
    forms.push(newForm);
    return newForm;
  },
  
  updateForm: (id, formData) => {
    const index = forms.findIndex(form => form.id === id);
    if (index === -1) return null;
    
    forms[index] = {
      ...forms[index],
      ...formData,
      updatedAt: new Date().toISOString()
    };
    return forms[index];
  },
  
  deleteForm: (id) => {
    const index = forms.findIndex(form => form.id === id);
    if (index === -1) return false;
    
    forms.splice(index, 1);
    return true;
  },
  
  // Submission operations
  getSubmissions: (formId) => {
    return submissions.filter(sub => sub.formId === formId);
  },
  
  createSubmission: (submissionData) => {
    const newSubmission = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...submissionData
    };
    submissions.push(newSubmission);
    return newSubmission;
  },
  
  getAllSubmissions: () => submissions
};
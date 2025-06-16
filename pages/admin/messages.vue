<template>
  <v-container fluid class="admin-messages-page-vuetify" style="height: calc(100vh - 100px);">
    <v-row style="height: 100%;">
      <!-- Section 1: Conversation List -->
      <v-col cols="12" md="4" class="conversation-list-col">
        <v-card class="fill-height d-flex flex-column">
          <v-card-title class="text-h5">Conversations</v-card-title>
          <v-divider></v-divider>
          <v-card-text class="flex-grow-1 overflow-y-auto pa-0">
            <div v-if="loadingConversations" class="d-flex justify-center align-center fill-height">
              <v-progress-circular indeterminate color="primary"></v-progress-circular>
            </div>
            <v-alert v-else-if="conversations.length === 0" type="info" class="ma-3">
              No active conversations with unread messages.
            </v-alert>
            <v-list v-else two-line>
              <template v-for="(convo, index) in conversations" :key="convo.id">
                <v-list-item
                  @click="selectConversation(convo)"
                  :class="{ 'blue lighten-4': selectedConversation && selectedConversation.id === convo.id }"
                  link
                >
                  <v-list-item-content>
                    <v-list-item-title>Order ID: {{ convo.order.id }}</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ convo.user.name }} ({{ convo.user.email }})
                    </v-list-item-subtitle>
                    <v-list-item-subtitle class="text--secondary text-truncate">
                      {{ convo.lastMessage.snippet }}
                    </v-list-item-subtitle>
                  </v-list-item-content>
                  <v-list-item-action>
                    <v-list-item-action-text>
                      {{ formatTimestamp(convo.lastMessage.timestamp) }}
                    </v-list-item-action-text>
                     <v-badge
                        v-if="convo.unreadCount > 0"
                        color="red"
                        :content="convo.unreadCount"
                        inline
                        class="mt-1"
                      ></v-badge>
                  </v-list-item-action>
                </v-list-item>
                <v-divider :key="'divider-' + convo.id" v-if="index < conversations.length - 1"></v-divider>
              </template>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Section 2: Chat Detail View -->
      <v-col cols="12" md="8" class="chat-detail-col">
        <v-card class="fill-height d-flex flex-column">
          <div v-if="!selectedConversation" class="d-flex justify-center align-center fill-height">
            <v-alert type="info" class="ma-3">
              Select a conversation to view messages.
            </v-alert>
          </div>
          <template v-else>
            <v-card-title class="text-h6">
              Chat with {{ selectedConversation.user.name }} (Order: {{ selectedConversation.order.id }})
            </v-card-title>
            <v-divider></v-divider>
            <v-card-text class="flex-grow-1 overflow-y-auto pa-3 chat-history-vuetify">
              <div v-if="loadingChatHistory" class="d-flex justify-center align-center fill-height">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
              </div>
              <div v-else>
                <div
                  v-for="message in chatHistory"
                  :key="message.id"
                  class="message-container my-2"
                  :class="message.sender_type === 'admin' ? 'd-flex justify-end' : 'd-flex justify-start'"
                >
                  <v-sheet
                    rounded="lg"
                    class="pa-2 message-bubble"
                    :color="message.sender_type === 'admin' ? 'light-blue lighten-4' : 'grey lighten-3'"
                    max-width="80%"
                  >
                    <p class="font-weight-bold mb-1 text--primary">{{ message.sender_name }}:</p>
                    <p class="mb-1 text--primary">{{ message.message }}</p>
                    <p class="text-caption text--secondary text-right mb-0">
                      {{ formatTimestamp(message.created_at) }}
                    </p>
                  </v-sheet>
                </div>
              </div>
            </v-card-text>
            <v-divider></v-divider>
            <v-card-actions class="pa-3">
              <v-textarea
                v-model="replyMessage"
                outlined
                rows="2"
                dense
                hide-details
                placeholder="Type your reply..."
                class="mr-2"
                no-resize
              ></v-textarea>
              <v-btn
                color="primary"
                @click="sendReply"
                :disabled="sendingReply || !replyMessage.trim()"
                :loading="sendingReply"
                large
              >
                Send
                <v-icon right>mdi-send</v-icon>
              </v-btn>
            </v-card-actions>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: 'AdminMessagesPage',
  data() {
    return {
      loadingConversations: false,
      conversations: [], // Stores grouped conversations with unread messages
      selectedConversation: null, // Stores the currently selected conversation object
      loadingChatHistory: false,
      chatHistory: [], // Stores messages for the selected conversation
      replyMessage: '',
      sendingReply: false,
      // Placeholder for admin user ID - this will be needed for marking messages read
      // and potentially for other logic. It should be fetched from auth state.
      adminUserId: null,
    };
  },
  methods: {
    async fetchConversations() {
      this.loadingConversations = true;
      try {
        const response = await this.$api.get('/messages');
        if (response.data && response.data.status) {
          this.processAndGroupMessages(response.data.payload || []);
        } else {
          console.error('Failed to fetch conversations: API returned unsuccessful status', response.data);
          alert('Failed to load conversations. ' + (response.data?.payload || 'Unknown API error.'));
          this.conversations = [];
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
        if (error.response) {
          console.error('Error response data:', error.response.data);
          alert(`Failed to fetch conversations: ${error.response.data?.payload || error.message}`);
        } else {
          alert('Failed to fetch conversations: ' + error.message);
        }
        this.conversations = [];
      } finally {
        this.loadingConversations = false;
      }
    },
    processAndGroupMessages(messages) {
      const groups = messages.reduce((acc, message) => {
        const orderId = message.order.id;
        if (!acc[orderId]) {
          acc[orderId] = [];
        }
        acc[orderId].push(message);
        return acc;
      }, {});

      const processedConversations = Object.entries(groups).map(([orderId, groupMessages]) => {
        // Sort messages within the group to find the last one easily
        groupMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const lastMessageInGroup = groupMessages[0];

        let user = {};
        // Prioritize order.user for customer details
        if (lastMessageInGroup.order && lastMessageInGroup.order.user) {
          user = {
            id: lastMessageInGroup.order.user.id,
            name: lastMessageInGroup.order.user.full_name || 'Unknown User',
            email: lastMessageInGroup.order.user.email || 'N/A',
          };
        } else if (lastMessageInGroup.sender_type === 'admin') { // If admin sent last, user is recipient
          user = {
            id: lastMessageInGroup.recipient?.id,
            name: lastMessageInGroup.recipient?.full_name || 'Unknown User',
            email: lastMessageInGroup.recipient?.email || 'N/A',
          };
        } else { // If user sent last, user is sender
          user = {
            id: lastMessageInGroup.sender?.id,
            name: lastMessageInGroup.sender?.full_name || 'Unknown User',
            email: lastMessageInGroup.sender?.email || 'N/A',
          };
        }

        return {
          id: parseInt(orderId), // Group key (Order ID)
          order: lastMessageInGroup.order, // Full order object from the last message
          user: user,
          lastMessage: {
            id: lastMessageInGroup.id,
            snippet: lastMessageInGroup.message.substring(0, 50) + (lastMessageInGroup.message.length > 50 ? '...' : ''),
            timestamp: lastMessageInGroup.created_at,
            sender_type: lastMessageInGroup.sender_type,
          },
          // Assuming all messages fetched by GET /messages are unread for that admin
          // Or, if the API provides an is_read flag, filter by !is_read before grouping.
          // For this simulation, all fetched messages for a group are considered part of the unread count.
          unreadCount: groupMessages.filter(m => !m.is_read || m.recipient?.id === this.adminUserId).length // Example logic
        };
      });

      // Sort conversations by the timestamp of their last message in descending order
      processedConversations.sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));

      this.conversations = processedConversations;
    },
    selectConversation(conversation) {
      console.log('Selected conversation:', conversation);
      this.selectedConversation = conversation;
      this.chatHistory = []; // Clear previous chat history
      this.fetchChatHistory(conversation.order.id);
    },
    async fetchChatHistory(orderId) {
      this.loadingChatHistory = true;
      try {
        const response = await this.$api.get(`/messages/chat/${orderId}`);
        if (response.data && response.data.status) {
          // Messages should be sorted by created_at ascending (chat order)
          this.chatHistory = (response.data.payload || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          this.markMessagesAsRead(orderId);
        } else {
          console.error(`Failed to fetch chat history for order ${orderId}: API returned unsuccessful status`, response.data);
          alert(`Failed to load chat history. ${response.data?.payload || 'Unknown API error.'}`);
          this.chatHistory = [];
        }
      } catch (error) {
        console.error(`Error fetching chat history for order ${orderId}:`, error);
        if (error.response) {
          console.error('Error response data:', error.response.data);
          alert(`Failed to fetch chat history: ${error.response.data?.payload || error.message}`);
        } else {
          alert('Failed to fetch chat history: ' + error.message);
        }
        this.chatHistory = [];
      } finally {
        this.loadingChatHistory = false;
      }
    },
    async sendReply() {
      if (!this.replyMessage.trim()) {
        alert('Please enter a message.');
        return;
      }
      if (!this.selectedConversation || !this.selectedConversation.order || !this.selectedConversation.user) {
        console.error('No selected conversation, order, or user to send reply to.');
        alert('Cannot send reply: No active conversation selected.');
        return;
      }

      const orderId = this.selectedConversation.order.id;
      const recipientId = this.selectedConversation.user.id;
      const payload = {
        message: this.replyMessage,
        orderId: orderId,
        recipientId: recipientId,
      };

      this.sendingReply = true;
      try {
        const response = await this.$api.post('/messages/admin', payload);
        if (response.data && response.data.status) {
          console.log('Reply sent successfully.');
          this.replyMessage = '';
          await this.fetchChatHistory(orderId); // Refresh chat history
        } else {
          console.error('Failed to send reply: API returned unsuccessful status', response.data);
          alert(`Failed to send reply. ${response.data?.payload || 'Unknown API error.'}`);
        }
      } catch (error) {
        console.error('Error sending reply:', error);
        if (error.response) {
          console.error('Error response data:', error.response.data);
          alert(`Failed to send reply: ${error.response.data?.payload || error.message}`);
        } else {
          alert('Failed to send reply: ' + error.message);
        }
      } finally {
        this.sendingReply = false;
      }
    },
    async markMessagesAsRead(orderId) {
      console.log('Attempting to mark messages as read for order:', orderId);
      try {
        const response = await this.$api.patch(`/messages/read/${orderId}`);
        if (response.data && response.data.status) {
          console.log('Successfully marked messages as read for order (API):', orderId);

          const convoIndex = this.conversations.findIndex(c => c.order.id === orderId);
          if (convoIndex !== -1) {
            if (typeof this.conversations[convoIndex].unreadCount === 'number') {
               this.conversations[convoIndex].unreadCount = 0;
            }
          }
        } else {
          console.error('Failed to mark messages as read: API returned unsuccessful status for order ' + orderId, response.data);
          // Do not alert here as it might be too intrusive if it fails silently
        }
      } catch (error) {
        console.error('Error marking messages as read for order ' + orderId + ':', error);
        if (error.response) {
          console.error('Error response data:', error.response.data);
        }
        // Do not alert here
      }
    },
    formatTimestamp(timestamp) {
      if (!timestamp) return '';
      return new Date(timestamp).toLocaleString();
    }
  },
  created() {
    // Fetch initial conversations when component is created
    // this.fetchConversations(); // Moved to mounted()

    // Example: Set adminUserId from a global store or auth plugin if available
    // if (this.$auth && this.$auth.user) {
    //   this.adminUserId = this.$auth.user.id;
    // }
  },
  mounted() {
    this.fetchConversations();
  },
};
</script>

<style scoped>
.admin-messages-page-vuetify {
  font-family: Arial, sans-serif; /* Or your preferred Vuetify font */
}

.conversation-list-col, .chat-detail-col {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.fill-height {
  height: 100%;
}

.overflow-y-auto {
  overflow-y: auto;
}

.chat-history-vuetify {
  /* Add any specific styling for chat history area if needed */
  /* Example: background-color: #f5f5f5; */
}

.message-container {
  display: flex; /* This will be controlled by justify-end or justify-start */
  width: 100%;
}

.message-bubble {
  word-wrap: break-word; /* Ensure long words break */
  white-space: pre-wrap; /* Preserve line breaks and spaces */
  /* font-size: 0.9rem; /* Adjust font size if needed */
}

/* Keeping these for reference or minor adjustments if v-sheet colors are not enough */
/* .user-message .message-bubble {
  background-color: #e1f5fe; // Example: Vuetify blue lighten-5
}
.admin-message .message-bubble {
  background-color: #dcf8c6; // Example: Vuetify green lighten-5
} */

/* Specificity for sender name if needed */
.message-bubble .font-weight-bold {
  /* color: #0277bd; /* Example for user sender name */
}
/* .admin-message .message-bubble .font-weight-bold {
  color: #4caf50; /* Example for admin sender name */
/*}*/

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Ensure v-textarea in reply doesn't grow indefinitely if content is huge */
.v-textarea {
  max-height: 150px; /* Or as desired */
  overflow-y: auto;
}
</style>
